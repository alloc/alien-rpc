import * as ts from 'typescript'

function getTypeInfo(sourceCode: string) {
  // Create a virtual source file
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  )

  // Create a program
  const program = ts.createProgram(
    ['temp.ts'],
    {},
    {
      getSourceFile: fileName =>
        fileName === 'temp.ts' ? sourceFile : undefined,
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      getCanonicalFileName: fileName => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: () => true,
      readFile: () => '',
      getDefaultLibFileName: () => 'lib.d.ts',
    }
  )

  const typeChecker = program.getTypeChecker()

  function getFullyQualifiedType(type: ts.Type): string {
    if (type.isUnion()) {
      return type.types.map(getFullyQualifiedType).join(' | ')
    }
    if (type.isIntersection()) {
      return type.types.map(getFullyQualifiedType).join(' & ')
    }
    if (type.symbol && type.symbol.flags & ts.SymbolFlags.Interface) {
      const properties = type.getProperties().map(prop => {
        const propType = typeChecker.getTypeOfSymbolAtLocation(
          prop,
          prop.valueDeclaration!
        )
        return `${prop.name}${prop.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${getFullyQualifiedType(propType)}`
      })
      return `{ ${properties.join('; ')} }`
    }
    if (type.symbol && type.symbol.flags & ts.SymbolFlags.TypeAlias) {
      const aliasedType = typeChecker.getTypeAtLocation(
        type.symbol.declarations![0]
      )
      return getFullyQualifiedType(aliasedType)
    }
    return typeChecker.typeToString(type)
  }

  let results: Array<{
    name: string
    arguments: string[]
    returnType: string
  }> = []

  // Visit each node in the source file
  ts.forEachChild(sourceFile, node => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      const signature = typeChecker.getSignatureFromDeclaration(node)
      if (signature && node.name) {
        const parameters = signature.getParameters()
        const args = parameters.map(param => {
          const paramType = typeChecker.getTypeOfSymbolAtLocation(
            param,
            param.valueDeclaration!
          )
          return `${param.name}${param.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${getFullyQualifiedType(paramType)}`
        })

        const returnType = typeChecker.getReturnTypeOfSignature(signature)

        results.push({
          name: node.name.getText(),
          arguments: args,
          returnType: getFullyQualifiedType(returnType),
        })
      }
    }
  })

  return results
}

// Example usage
const sourceCode = `
interface Options {
  foo?: number
}

type Result = number & {}

export function foo(options?: Options) {
  const result: Result = (options?.foo ?? 0) + 1
  return result
}
`

const typeInfo = getTypeInfo(sourceCode)
console.log(JSON.stringify(typeInfo, null, 2))
