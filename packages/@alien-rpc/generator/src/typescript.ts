import { createProject, ts } from '@ts-morph/bootstrap'

export async function extractRouteTypes(sourceCode: string, fileName: string) {
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
    console.log('Diagnostics:')
    diagnostics.forEach(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
      if (diagnostic.file) {
        const { line, character } =
          diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
        console.log(
          `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
        )
      } else {
        console.log(message)
      }
    })
  } else {
    console.log('No diagnostics found.')
  }

  const results: {
    name: string
    arguments: string[]
    returnType: string
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

          console.log(
            `${declaration.name.getText()}: ${getFullyQualifiedType(type, typeChecker)}`
          )
        }
      }
    }
  })

  return results
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
