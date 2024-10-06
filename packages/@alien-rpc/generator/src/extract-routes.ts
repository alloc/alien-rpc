import type { RpcResponseType } from '@alien-rpc/client'
import { createProject, ts } from '@ts-morph/bootstrap'
import { debug } from './debug'
import {
  getFullyQualifiedType,
  isAsyncGeneratorType,
  isGeneratorType,
} from './util/ts-ast'

export async function extractRoutes(sourceCode: string, fileName: string) {
  const tsConfigFilePath = ts.findConfigFile(fileName, ts.sys.fileExists)
  const project = await createProject({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  })

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

        console.warn(
          `${message} (${diagnostic.file.fileName}:${line + 1}:${character + 1})`
        )
      } else {
        console.warn(message)
      }
    })
  }

  const validRouteMethods = ['get', 'post']

  const routes: {
    httpMethod: string
    exportedName: string
    resolvedPathLiteral: string
    resolvedArguments: string[]
    resolvedResponse: string
    responseType: RpcResponseType
  }[] = []

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
          const callExpression =
            declaration.initializer &&
            ts.isCallExpression(declaration.initializer) &&
            declaration.initializer

          if (!callExpression) {
            return
          }

          const calleeIdentifier =
            ts.isIdentifier(callExpression.expression) &&
            callExpression.expression

          if (!calleeIdentifier) {
            return
          }

          const calleeName = calleeIdentifier.text
          if (!validRouteMethods.includes(calleeName)) {
            return
          }

          const handlerArgument = callExpression.arguments[1]

          if (
            !ts.isArrowFunction(handlerArgument) &&
            !ts.isFunctionExpression(handlerArgument)
          ) {
            if (debug.enabled)
              debug(
                `handler is not an inline function (${getNodeLocation(handlerArgument)})`
              )
            return
          }

          const exportedName = symbol.getName()

          const pathArgument = callExpression.arguments[0]
          const resolvedPathLiteral = getFullyQualifiedType(
            typeChecker.getTypeAtLocation(pathArgument),
            typeChecker
          )

          const handlerSignature =
            typeChecker.getSignatureFromDeclaration(handlerArgument)!

          const resolvedArguments = handlerSignature.parameters
            .slice(0, 2)
            .map(param => {
              const paramType = typeChecker.getTypeAtLocation(
                param.valueDeclaration!
              )
              return getFullyQualifiedType(paramType, typeChecker, {
                omitUndefinedLiteral: true,
              })
            })

          const handlerResultType = typeChecker.getAwaitedType(
            handlerSignature.getReturnType()
          )
          if (!handlerResultType) {
            console.error(
              `handler return type could not be resolved (${getNodeLocation(
                handlerArgument
              )})`
            )
            return
          }

          const resolvedResponse = resolveResponseType(
            handlerResultType,
            typeChecker
          )

          type A = NodeJS.TypedArray | Buffer | NodeJS.ReadableStream

          const responseType = typeChecker.isTypeAssignableTo(
            handlerResultType,
            typeChecker.getStringType()
          )
            ? 'text'
            : resolvedReturn === 'Buffer' ||
                resolvedReturn.startsWith('ReadableStream<')
              ? 'blob'
              : resolvedReturn.startsWith('AsyncGenerator<')
                ? 'ndjson'
                : 'json'

          routes.push({
            httpMethod: calleeName,
            exportedName,
            resolvedPathLiteral,
            resolvedArguments,
            resolvedResponse,
            responseType,
          })
        }
      }
    }
  })

  return routes
}

function getNodeLocation(node: ts.Node) {
  const sourceFile = node.getSourceFile()
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart()
  )

  return `${sourceFile.fileName}:${line + 1}:${character + 1}`
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

function inferGeneratorType(
  type: ts.Type,
  typeChecker: ts.TypeChecker
): string | undefined {
  return undefined
}

function hasTypeArguments(
  type: ts.Type
): type is ts.Type & { typeArguments: readonly ts.Type[] } {
  return (type as ts.TypeReference).typeArguments !== undefined
}
