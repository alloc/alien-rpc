import { ts } from '@ts-morph/bootstrap'

/**
 * Convert a given type to its string representation, resolving any type
 * names into type literals (recursively).
 */
export function printTypeLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: { omitUndefinedLiteral?: boolean } = {},
  seen = new Set<ts.Type>()
): string {
  if (seen.has(type)) {
    // Prevent infinite recursion by returning an unresolved type.
    return typeChecker.typeToString(type)
  }

  seen.add(type)

  if (type.isUnion()) {
    let variants = type.types
    if (opts.omitUndefinedLiteral) {
      variants = variants.filter(variant => {
        return !isUndefinedType(variant)
      })
    }
    return variants
      .map(variant => printTypeLiteral(variant, typeChecker, opts, seen))
      .join(' | ')
  }

  if (type.isIntersection()) {
    return type.types
      .map(intersectedType =>
        printTypeLiteral(intersectedType, typeChecker, opts, seen)
      )
      .join(' & ')
  }

  if (isBuiltInType(type)) {
    return typeChecker.typeToString(type)
  }

  if (typeChecker.isArrayType(type)) {
    const typeArguments = (type as ts.TypeReference).typeArguments
    if (typeArguments && typeArguments.length > 0) {
      return `Array<${printTypeLiteral(typeArguments[0], typeChecker, opts, seen)}>`
    }
  }

  const typeSymbol = type.getSymbol()

  if (typeSymbol) {
    if (isTypeAlias(typeSymbol)) {
      const aliasedType = typeChecker.getTypeOfSymbol(typeSymbol)
      return printTypeLiteral(aliasedType, typeChecker, opts, seen)
    }

    if (isObjectType(typeSymbol) || isInterfaceType(typeSymbol)) {
      const properties = type.getProperties().map(prop => {
        const propType = typeChecker.getTypeOfSymbol(prop)
        return `${prop.name}${prop.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${printTypeLiteral(propType, typeChecker, opts, seen)}`
      })

      const stringIndexType = type.getStringIndexType()
      if (stringIndexType) {
        properties.push(
          `[key: string]: ${printTypeLiteral(stringIndexType, typeChecker, opts, seen)}`
        )
      }

      const numberIndexType = type.getNumberIndexType()
      if (numberIndexType) {
        properties.push(
          `[index: number]: ${printTypeLiteral(numberIndexType, typeChecker, opts, seen)}`
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
