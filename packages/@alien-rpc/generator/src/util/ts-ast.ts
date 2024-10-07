import { ts } from '@ts-morph/bootstrap'

export function getFullyQualifiedType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: { omitUndefinedLiteral?: boolean } = {}
): string {
  if (type.isUnion()) {
    let variants = type.types
    if (opts.omitUndefinedLiteral) {
      variants = variants.filter(variant => {
        return !isUndefinedType(variant)
      })
    }
    return variants
      .map(variant => getFullyQualifiedType(variant, typeChecker, opts))
      .join(' | ')
  }

  if (type.isIntersection()) {
    return type.types
      .map(intersectedType =>
        getFullyQualifiedType(intersectedType, typeChecker, opts)
      )
      .join(' & ')
  }

  if (isBuiltInType(type)) {
    return typeChecker.typeToString(type)
  }

  if (typeChecker.isArrayType(type)) {
    const typeArguments = (type as ts.TypeReference).typeArguments
    if (typeArguments && typeArguments.length > 0) {
      return `Array<${getFullyQualifiedType(
        typeArguments[0],
        typeChecker,
        opts
      )}>`
    }
  }

  const typeSymbol = type.getSymbol()

  if (typeSymbol) {
    if (isTypeAlias(typeSymbol)) {
      const aliasedType = typeChecker.getTypeAtLocation(
        type.symbol.declarations![0]
      )
      return getFullyQualifiedType(aliasedType, typeChecker, opts)
    }

    if (isObjectType(typeSymbol) || isInterfaceType(typeSymbol)) {
      const properties = type.getProperties().map(prop => {
        const propType = typeChecker.getTypeOfSymbol(prop)
        return `${prop.name}${prop.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${getFullyQualifiedType(propType, typeChecker, opts)}`
      })

      const stringIndexType = type.getStringIndexType()
      if (stringIndexType) {
        properties.push(
          `[key: string]: ${getFullyQualifiedType(stringIndexType, typeChecker, opts)}`
        )
      }

      const numberIndexType = type.getNumberIndexType()
      if (numberIndexType) {
        properties.push(
          `[index: number]: ${getFullyQualifiedType(numberIndexType, typeChecker, opts)}`
        )
      }

      return `{ ${properties.join('; ')} }`
    }
  }

  return typeChecker.typeToString(type)
}

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
  return type.symbol && type.symbol.name === 'AsyncGenerator'
}

export function isGeneratorType(type: ts.Type): type is ts.TypeReference {
  return type.symbol && type.symbol.name === 'Generator'
}

function isBuiltInType(type: ts.Type): boolean {
  const declarations = type.symbol?.getDeclarations()
  return Boolean(
    declarations?.some(declaration => {
      const fileName = declaration.getSourceFile().fileName
      return fileName.includes('/node_modules/typescript/lib/')
    })
  )
}

function isUndefinedType(type: ts.Type): boolean {
  return Boolean(type.flags & ts.TypeFlags.Undefined)
}
