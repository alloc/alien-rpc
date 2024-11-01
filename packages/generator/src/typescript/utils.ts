import { ts } from '@ts-morph/common'

export function isTypeAlias(symbol: ts.Symbol): boolean {
  return Boolean(symbol.flags & ts.SymbolFlags.TypeAlias)
}

export function isInterfaceType(symbol: ts.Symbol): boolean {
  return Boolean(symbol.flags & ts.SymbolFlags.Interface)
}

export function isObjectType(symbol: ts.Symbol): boolean {
  return Boolean(
    symbol.flags & ts.SymbolFlags.TypeLiteral ||
      symbol.flags & ts.SymbolFlags.ObjectLiteral
  )
}

export function bitwiseEnumToArray(
  flags: number,
  enumValues: Record<number, string>
) {
  return Object.entries(enumValues)
    .filter(([value]) => flags & Number(value))
    .map(([_, name]) => name)
}

export function isAsyncGeneratorType(type: ts.Type): type is ts.TypeReference {
  const symbol = type.getSymbol()
  return Boolean(symbol && symbol.name === 'AsyncGenerator')
}

export function isLibSymbol(symbol: ts.Symbol): boolean {
  const declarations = symbol?.getDeclarations()
  return Boolean(
    declarations?.some(declaration => {
      const fileName = declaration.getSourceFile().fileName
      return fileName.includes('/node_modules/typescript/lib/')
    })
  )
}

export function isUndefinedType(type: ts.Type): boolean {
  return Boolean(type.flags & ts.TypeFlags.Undefined)
}

export function isAnyType(type: ts.Type): boolean {
  return Boolean(type.flags & ts.TypeFlags.Any)
}

export function isAssignableTo(
  typeChecker: ts.TypeChecker,
  type: ts.Type,
  target: (typeChecker: ts.TypeChecker) => ts.Type
) {
  return typeChecker.isTypeAssignableTo(type, target(typeChecker))
}

export function getArrayElementType(type: ts.Type): ts.Type {
  return (type as ts.TypeReference).typeArguments![0]
}

export function* getTupleElements(type: ts.Type): Generator<ts.Symbol> {
  for (const symbol of type.getProperties()) {
    if (symbol.escapedName === 'length') break
    yield symbol
  }
}

export function iterableToString(iterable: Iterable<string>): string {
  let result = ''
  for (const value of iterable) {
    result += value
  }
  return result
}
