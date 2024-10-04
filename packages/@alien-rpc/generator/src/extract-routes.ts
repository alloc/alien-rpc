import { createProject, ts } from '@ts-morph/bootstrap'
import { debug } from './debug'

export async function extractRoutes(sourceCode: string, fileName: string) {
  const tsConfigFilePath = ts.findConfigFile(fileName, ts.sys.fileExists)
  console.log('tsConfigFilePath', tsConfigFilePath)

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

  const validRouteTypes = ['get', 'post']

  const routes: {
    httpMethod: string
    exportedName: string
    resolvedPathLiteral: string
    resolvedHandlerParams: string[]
    resolvedHandlerReturnType: string
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
          const type = typeChecker.getTypeOfSymbolAtLocation(
            symbol,
            declaration
          )

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
          if (!validRouteTypes.includes(calleeName)) {
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

          const resolvedHandlerParams = handlerSignature.parameters
            .slice(0, 2)
            .map(param => {
              const paramType = typeChecker.getTypeAtLocation(
                param.valueDeclaration!
              )
              return getFullyQualifiedType(paramType, typeChecker)
            })

          const resolvedHandlerReturnType = getFullyQualifiedType(
            handlerSignature.getReturnType(),
            typeChecker
          )

          routes.push({
            httpMethod: calleeName,
            exportedName,
            resolvedPathLiteral,
            resolvedHandlerParams,
            resolvedHandlerReturnType,
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

function getFullyQualifiedType(
  type: ts.Type,
  typeChecker: ts.TypeChecker
): string {
  if (type.isUnion()) {
    return type.types
      .map(variantType => getFullyQualifiedType(variantType, typeChecker))
      .join(' | ')
  }
  if (type.isIntersection()) {
    return type.types
      .map(intersectedType =>
        getFullyQualifiedType(intersectedType, typeChecker)
      )
      .join(' & ')
  }
  if (type.symbol && type.symbol.flags & ts.SymbolFlags.Interface) {
    const properties = type.getProperties().map(prop => {
      const propType = typeChecker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration!
      )
      return `${prop.name}${prop.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${getFullyQualifiedType(propType, typeChecker)}`
    })
    return `{ ${properties.join('; ')} }`
  }
  if (type.symbol && type.symbol.flags & ts.SymbolFlags.TypeAlias) {
    const aliasedType = typeChecker.getTypeAtLocation(
      type.symbol.declarations![0]
    )
    return getFullyQualifiedType(aliasedType, typeChecker)
  }
  return typeChecker.typeToString(type)
}
