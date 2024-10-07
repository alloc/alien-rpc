import type { RpcResponseFormat } from '@alien-rpc/client'
import { createProject, Project, ts } from '@ts-morph/bootstrap'
import path from 'node:path'
import { debug } from './debug'
import {
  getFullyQualifiedType,
  isAsyncGeneratorType,
  isGeneratorType,
  isObjectType,
} from './util/ts-ast'

export async function extractRoutes(sourceCode: string, fileName: string) {
  const tsConfigFilePath = ts.findConfigFile(fileName, ts.sys.fileExists)
  const project = await createProject({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  })

  const inferNodeTypes = defineNodeTypes(project, path.dirname(fileName))
  const sourceFile = project.createSourceFile(fileName, sourceCode)
  project.resolveSourceFileDependencies()

  const program = project.createProgram()
  const typeChecker = program.getTypeChecker()
  const nodeTypes = inferNodeTypes(typeChecker)

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

        console.warn(
          `${message} (${diagnostic.file.fileName}:${line + 1}:${character + 1})`
        )
      } else {
        console.warn(message)
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
          const expressionType = typeChecker.getTypeAtLocation(declaration.name)
          try {
            const route = extractRoute(
              routeName,
              expressionType,
              typeChecker,
              nodeTypes
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
  httpMethod: string
  exportedName: string
  responseFormat: RpcResponseFormat
  resolvedPathLiteral: string
  resolvedArguments: string[]
  resolvedResponse: string
}

function extractRoute(
  routeName: string,
  declarationType: ts.Type,
  typeChecker: ts.TypeChecker,
  nodeTypes: Record<string, ts.Type>
): ExtractedRoute | null {
  if (!isObjectType(declarationType.symbol)) {
    return null
  }

  console.log(typeChecker.typeToString(declarationType))

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
      nodeTypes.RouteMethod
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
    .getTypeOfSymbol(handler)
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

  const httpMethod = getFullyQualifiedType(
    typeChecker.getTypeOfSymbol(method),
    typeChecker
  )

  const resolvedPathLiteral = getFullyQualifiedType(
    typeChecker.getTypeOfSymbol(path),
    typeChecker
  )

  const resolvedArguments = handlerCallSignature.parameters
    .slice(0, 2)
    .map(param => {
      const paramType = typeChecker.getTypeAtLocation(param.valueDeclaration!)
      return getFullyQualifiedType(paramType, typeChecker, {
        omitUndefinedLiteral: true,
      })
    })

  const resolvedResponse = resolveResponseType(handlerResultType, typeChecker)

  const responseFormat = inferResponseFormat(
    handlerResultType,
    typeChecker,
    nodeTypes
  )

  return {
    httpMethod,
    exportedName: routeName,
    responseFormat,
    resolvedPathLiteral,
    resolvedArguments,
    resolvedResponse,
  }
}

function resolveResponseType(type: ts.Type, typeChecker: ts.TypeChecker) {
  if (hasTypeArguments(type)) {
    const iteratorType = isAsyncGeneratorType(type)
      ? 'AsyncIterableIterator'
      : isGeneratorType(type)
        ? 'IterableIterator'
        : undefined

    if (iteratorType) {
      const yieldType = getFullyQualifiedType(
        type.typeArguments[0],
        typeChecker
      )
      return `${iteratorType}<${yieldType}>`
    }
  }
  return getFullyQualifiedType(type, typeChecker)
}

interface TypeArguments {
  typeArguments: ts.Type[]
}

function hasTypeArguments(type: ts.Type): type is ts.Type & TypeArguments {
  return (type as ts.TypeReference).typeArguments !== undefined
}

function defineNodeTypes(project: Project, rootDir: string) {
  const arpcService = 'import("@alien-rpc/service")'

  const nodeTypes = [
    ['Response', 'globalThis.Response'],
    [
      'IterableIterator',
      'globalThis.Generator | globalThis.AsyncGenerator | globalThis.IterableIterator<unknown> | globalThis.AsyncIterableIterator<unknown>',
    ],
    ['JSON', '{ [key: string]: JSON } | readonly JSON[] | JSONValue'],
    ['JSONValue', 'string | number | boolean | null | undefined'],
    ['ValidResult', 'Response | IterableIterator | JSON'],
    ['RouteMethod', arpcService + '.RouteMethod'],
  ] as const

  const sourceFile = project.createSourceFile(
    path.join(rootDir, 'alien-rpc__node-types.ts'),
    nodeTypes
      .map(([exportedName, type]) => {
        return `export type ${exportedName} = ${type}`
      })
      .join('\n')
  )

  const syntaxList = sourceFile.getChildAt(0)

  return (typeChecker: ts.TypeChecker) =>
    Object.fromEntries(
      nodeTypes.map(([exportedName], i) => {
        const resolvedType = typeChecker.getTypeAtLocation(
          syntaxList.getChildAt(i)
        )
        if (resolvedType.flags & ts.TypeFlags.Any) {
          throw new Error(
            `Could not resolve ${exportedName} type. Make sure @types/node is installed in your project.`
          )
        }
        return [exportedName, resolvedType]
      })
    ) as {
      [K in (typeof nodeTypes)[number][0]]: ts.Type
    }
}

function inferResponseFormat(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  nodeTypes: Record<string, ts.Type>
) {
  if (type.flags & ts.TypeFlags.Any) {
    throw new InvalidResponseTypeError('Your route is not type-safe.')
  }
  if (typeChecker.isTypeAssignableTo(type, nodeTypes.Response)) {
    return 'response'
  }
  if (typeChecker.isTypeAssignableTo(type, nodeTypes.IterableIterator)) {
    const yieldType = (type as ts.Type & TypeArguments).typeArguments[0]
    if (!typeChecker.isTypeAssignableTo(yieldType, nodeTypes.JSON)) {
      throw new InvalidResponseTypeError(
        'Your route yields an unsupported type.'
      )
    }
    return 'ndjson'
  }
  if (typeChecker.isTypeAssignableTo(nodeTypes.Response, type)) {
    throw new InvalidResponseTypeError(
      'Routes that return a `new Response()` cannot ever return anything else.'
    )
  }
  if (typeChecker.isTypeAssignableTo(nodeTypes.IterableIterator, type)) {
    throw new InvalidResponseTypeError(
      'Routes that return an iterator cannot ever return anything else.'
    )
  }
  if (!typeChecker.isTypeAssignableTo(type, nodeTypes.ValidResult)) {
    throw new InvalidResponseTypeError(
      'Your route returns an unsupported type.'
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
