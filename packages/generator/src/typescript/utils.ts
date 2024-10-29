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

export function isBuiltInType(type: ts.Type): boolean {
  const symbol = type.getSymbol()
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
