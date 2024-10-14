import type { RpcResultFormat } from '@alien-rpc/client'
import { createProject, Project, ts } from '@ts-morph/bootstrap'
import path from 'node:path'
import { debug, reportDiagnostic } from './debug'
import {
  isAsyncGeneratorType,
  isObjectType,
  printTypeLiteral,
} from './util/ts-ast'

export async function extractRoutes(sourceCode: string, fileName: string) {
  const tsConfigFilePath = ts.findConfigFile(fileName, ts.sys.fileExists)
  const project = await createProject({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  })

  const types = createSupportingTypes(project, path.dirname(fileName))
  const sourceFile = project.createSourceFile(fileName, sourceCode)
  project.resolveSourceFileDependencies()

  const program = project.createProgram()
  const typeChecker = program.getTypeChecker()

  const diagnostics = program.getSemanticDiagnostics(sourceFile)
  if (diagnostics.length > 0) {
    diagnostics.forEach(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
      if (diagnostic.file) {
        const { line, character } =
          diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)

        reportDiagnostic(
          `${message} (${diagnostic.file.fileName}:${line + 1}:${character + 1})`
        )
      } else {
        reportDiagnostic(message)
      }
    })
  }

  const routes: ExtractedRoute[] = []

  ts.forEachChild(sourceFile, node => {
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      const declaration = node.declarationList.declarations[0]
      if (ts.isVariableDeclaration(declaration) && declaration.name) {
        const symbol = typeChecker.getSymbolAtLocation(declaration.name)
        if (symbol) {
          const routeName = symbol.getName()
          try {
            const route = extractRoute(
              routeName,
              declaration,
              typeChecker,
              types
            )
            if (route) {
              debug('extracted route', route)
              routes.push(route)
            }
          } catch (error: any) {
            Object.assign(error, { routeName })
            throw error
          }
        }
      }
    }
  })

  return routes
}

export type ExtractedRoute = {
  exportedName: string
  responseFormat: RpcResultFormat
  resolvedMethod: string
  resolvedPathname: string
  resolvedArguments: string[]
  resolvedResult: string
}

function extractRoute(
  routeName: string,
  declaration: ts.VariableDeclaration,
  typeChecker: ts.TypeChecker,
  types: SupportingTypes
): ExtractedRoute | null {
  const declarationType = typeChecker.getTypeAtLocation(declaration)
  if (!isObjectType(declarationType.symbol)) {
    return null
  }

  const method = typeChecker.getPropertyOfType(declarationType, 'method')
  if (!method) {
    debug(`[skip] Route "${routeName}" has no "method" property`)
    return null
  }

  const path = typeChecker.getPropertyOfType(declarationType, 'path')
  if (!path) {
    debug(`[skip] Route "${routeName}" has no "path" property`)
    return null
  }

  const handler = typeChecker.getPropertyOfType(declarationType, 'handler')
  if (!handler) {
    debug(`[skip] Route "${routeName}" has no "handler" property`)
    return null
  }

  if (
    !typeChecker.isTypeAssignableTo(
      typeChecker.getTypeOfSymbol(method),
      types.RouteMethod(typeChecker)
    )
  ) {
    throw new Error(
      `Route has an unsupported HTTP method: ${typeChecker.typeToString(typeChecker.getTypeOfSymbol(method))}`
    )
  }

  if (
    !typeChecker.isTypeAssignableTo(
      typeChecker.getTypeOfSymbol(path),
      typeChecker.getStringType()
    )
  ) {
    throw new Error(`Route path is not a string`)
  }

  const handlerCallSignatures = typeChecker
    .getTypeOfSymbolAtLocation(handler, declaration)
    .getCallSignatures()

  const handlerCallSignature = handlerCallSignatures[0]

  if (handlerCallSignatures.length !== 1) {
    throw new Error('Route handler must have exactly 1 call signature')
  }

  const handlerResultType = typeChecker.getAwaitedType(
    handlerCallSignature.getReturnType()
  )
  if (!handlerResultType) {
    throw new Error('Route handler has an unknown return type')
  }

  let resolvedMethod = printTypeLiteral(
    typeChecker.getTypeOfSymbol(method),
    typeChecker
  )

  try {
    resolvedMethod = JSON.parse(resolvedMethod) as string
  } catch {
    throw new Error(
      `Route must have a string literal for its "method" property.`
    )
  }

  let resolvedPathname = printTypeLiteral(
    typeChecker.getTypeOfSymbol(path),
    typeChecker
  )

  try {
    resolvedPathname = JSON.parse(resolvedPathname) as string
  } catch {
    throw new Error(`Route must have a string literal for its "path" property.`)
  }

  const resolvedArguments = handlerCallSignature.parameters
    .slice(0, 2)
    .map(param => {
      const paramType = typeChecker.getTypeOfSymbol(param)
      return printTypeLiteral(paramType, typeChecker, {
        omitUndefinedLiteral: true,
      })
    })

  const resolvedResult = resolveResultType(
    handlerResultType,
    typeChecker,
    types
  )

  const responseFormat = inferResponseFormat(
    handlerResultType,
    typeChecker,
    types
  )

  return {
    exportedName: routeName,
    responseFormat,
    resolvedMethod,
    resolvedPathname,
    resolvedArguments,
    resolvedResult,
  }
}

function resolveResultType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  types: SupportingTypes
) {
  // Prevent mapping of `Response` to literal type
  if (typeChecker.isTypeAssignableTo(type, types.Response(typeChecker))) {
    return 'Response'
  }

  // Coerce `void` to `undefined`
  if (typeChecker.isTypeAssignableTo(type, types.Void(typeChecker))) {
    return 'undefined'
  }

  // Async generators are coerced to `AsyncIterableIterator` since
  // typebox-codegen has no Type.AsyncGenerator validator
  if (isAsyncGeneratorType(type) && hasTypeArguments(type)) {
    const yieldType = printTypeLiteral(type.typeArguments[0], typeChecker)
    return `AsyncIterableIterator<${yieldType}>`
  }

  return printTypeLiteral(type, typeChecker)
}

interface TypeArguments {
  typeArguments: ts.Type[]
}

function hasTypeArguments(type: ts.Type): type is ts.Type & TypeArguments {
  return (type as ts.TypeReference).typeArguments !== undefined
}

type SupportingTypes = ReturnType<typeof createSupportingTypes>

/**
 * Supporting types are used when generating the route definitions for
 * client and server. They help us ensure that the routes don't use any
 * unsupported types.
 */
function createSupportingTypes(project: Project, rootDir: string) {
  const typeDeclarations = {
    AnyNonNull: '{}',
    Response: 'globalThis.Response',
    RouteIterator: 'import("@alien-rpc/service").RouteIterator',
    RouteMethod: 'import("@alien-rpc/service").RouteMethod',
    RouteResult: 'import("@alien-rpc/service").RouteResult',
    Void: 'void',
  } as const

  type TypeValidator = (typeChecker: ts.TypeChecker, type: ts.Type) => void

  const typeValidation: Record<string, TypeValidator> = {
    Response(typeChecker: ts.TypeChecker, type: ts.Type) {
      // If the type "{}" is assignable to our "Response" type, then
      // something is misconfigured on the user's end.
      if (typeChecker.isTypeAssignableTo(types.AnyNonNull(typeChecker), type)) {
        throw new Error(
          `Could not resolve Response type. Make sure @types/node is installed in your project. If already installed, it may need to be re-installed.`
        )
      }
    },
    RouteIterator(typeChecker: ts.TypeChecker, type: ts.Type) {
      // If the type "{}" is assignable to our "RouteIterator" type, then
      // something is misconfigured on the user's end.
      if (typeChecker.isTypeAssignableTo(types.AnyNonNull(typeChecker), type)) {
        throw new Error(
          `Could not resolve RouteIterator type. Make sure your tsconfig has "es2018" or higher in its \`lib\` array.`
        )
      }
    },
  }

  const sourceFile = project.createSourceFile(
    path.join(rootDir, '.alien-rpc/support.ts'),
    Object.entries(typeDeclarations)
      .map(([id, aliasedType]) => `export type ${id} = ${aliasedType}`)
      .join('\n')
  )

  type TypeGetter = (typeChecker: ts.TypeChecker) => ts.Type

  const typeCache: Record<string, ts.Type> = {}

  const syntaxList = sourceFile.getChildAt(0)
  const types = Object.fromEntries(
    Object.keys(typeDeclarations).map((typeName, i) => {
      const getType: TypeGetter = typeChecker => {
        let type = typeCache[typeName]
        if (type) {
          return type
        }

        const typeNode = syntaxList.getChildAt(i)
        if (!ts.isTypeAliasDeclaration(typeNode)) {
          throw new Error(
            `Expected "${typeName}" to be TypeAliasDeclaration, got ${ts.SyntaxKind[typeNode.kind]}`
          )
        }

        type = typeChecker.getTypeAtLocation(typeNode)
        if (typeName in typeValidation) {
          typeValidation[typeName](typeChecker, type)
        }

        typeCache[typeName] = type
        return type
      }

      return [typeName, getType] as const
    })
  ) as {
    [TypeName in keyof typeof typeDeclarations]: TypeGetter
  }

  return types
}

function inferResponseFormat(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  types: SupportingTypes
) {
  if (type.flags & ts.TypeFlags.Any) {
    throw new InvalidResponseTypeError('Your route is not type-safe.')
  }
  if (typeChecker.isTypeAssignableTo(type, types.Response(typeChecker))) {
    return 'response'
  }
  if (typeChecker.isTypeAssignableTo(type, types.RouteIterator(typeChecker))) {
    return 'json-seq'
  }
  if (typeChecker.isTypeAssignableTo(types.Response(typeChecker), type)) {
    throw new InvalidResponseTypeError(
      'Routes that return a `new Response()` cannot ever return anything else.'
    )
  }
  if (typeChecker.isTypeAssignableTo(type, types.RouteIterator(typeChecker))) {
    throw new InvalidResponseTypeError(
      'Routes that return an iterator cannot ever return anything else.'
    )
  }
  if (!typeChecker.isTypeAssignableTo(type, types.RouteResult(typeChecker))) {
    throw new InvalidResponseTypeError(
      'Your route returns an unsupported type: ' +
        printTypeLiteral(type, typeChecker)
    )
  }
  return 'json'
}

class InvalidResponseTypeError extends Error {
  name = 'InvalidResponseTypeError'
  constructor(detail?: string) {
    super('Invalid response type' + (detail ? ': ' + detail : ''))
  }
}
