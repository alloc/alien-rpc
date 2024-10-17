import type { RpcResultFormat } from '@alien-rpc/client'
import { ts } from '@ts-morph/bootstrap'
import { debug } from './debug.js'
import { ParseResult, SupportingTypes } from './parse.js'
import {
  isAsyncGeneratorType,
  isObjectType,
  printTypeLiteral,
} from './util/ts-ast.js'

export function analyzeRoutes({
  types,
  sourceFiles,
  typeChecker,
}: ParseResult) {
  const routes: AnalyzedRoute[] = []

  for (const sourceFile of sourceFiles) {
    ts.forEachChild(sourceFile, node => {
      if (
        !ts.isVariableStatement(node) ||
        !node.modifiers ||
        node.modifiers.every(
          modifier => modifier.kind !== ts.SyntaxKind.ExportKeyword
        )
      ) {
        return
      }

      const declaration = node.declarationList.declarations[0]
      if (!ts.isVariableDeclaration(declaration)) {
        return
      }

      const symbol =
        declaration.name && typeChecker.getSymbolAtLocation(declaration.name)
      if (!symbol) {
        return
      }

      const routeName = symbol.getName()
      try {
        const route = analyzeRoute(
          sourceFile.fileName,
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
    })
  }

  return routes
}

export type AnalyzedRoute = {
  fileName: string
  exportedName: string
  description: string | undefined
  resolvedFormat: RpcResultFormat
  resolvedMethod: string
  resolvedPathname: string
  resolvedArguments: string[]
  resolvedResult: string
}

function analyzeRoute(
  fileName: string,
  routeName: string,
  declaration: ts.VariableDeclaration,
  typeChecker: ts.TypeChecker,
  types: SupportingTypes
): AnalyzedRoute | null {
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

  const resolvedFormat = resolveResultFormat(
    handlerResultType,
    typeChecker,
    types
  )

  return {
    fileName,
    exportedName: routeName,
    description: extractDescription(declaration),
    resolvedFormat,
    resolvedMethod,
    resolvedPathname,
    resolvedArguments,
    resolvedResult,
  }
}

function extractDescription(declaration: ts.VariableDeclaration) {
  const docs = ts.getJSDocCommentsAndTags(declaration)
  if (docs.length > 0) {
    return docs
      .map(doc => {
        let text = ts.getTextOfJSDocComment(doc.comment) ?? ''
        if ('tags' in doc && doc.tags) {
          if (text) {
            text += '\n'
          }
          doc.tags.forEach(tag => {
            const tagText = ts.getTextOfJSDocComment(tag.comment)
            text +=
              (text ? '\n' : '') +
              '@' +
              tag.tagName.text +
              (tagText
                ? ' ' +
                  (ts.isJSDocSeeTag(tag) && tag.name
                    ? (tag.name.name as ts.Identifier).text
                    : '') +
                  tagText
                : '')
          })
        }
        return text
      })
      .join('\n')
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

function resolveResultFormat(
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
