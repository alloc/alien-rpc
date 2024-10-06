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

  if (type.symbol && type.symbol.flags & ts.SymbolFlags.TypeAlias) {
    const aliasedType = typeChecker.getTypeAtLocation(
      type.symbol.declarations![0]
    )
    return getFullyQualifiedType(aliasedType, typeChecker, opts)
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

  if (
    type.symbol &&
    (type.symbol.flags & ts.SymbolFlags.TypeLiteral ||
      type.symbol.flags & ts.SymbolFlags.ObjectLiteral ||
      type.symbol.flags & ts.SymbolFlags.Interface)
  ) {
    // console.log({
    //   type: typeChecker.typeToString(type),
    //   flags: bitwiseEnumToArray(type.symbol.flags, ts.SymbolFlags),
    // })

    const properties = type.getProperties().map(prop => {
      const propType = typeChecker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration!
      )
      return `${prop.name}${prop.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${getFullyQualifiedType(propType, typeChecker, opts)}`
    })
    return `{ ${properties.join('; ')} }`
  }

  if (type.symbol && type.symbol.flags) {
    console.log({
      type: typeChecker.typeToString(type),
      flags: bitwiseEnumToArray(type.symbol.flags, ts.SymbolFlags),
    })
  }

  return typeChecker.typeToString(type)
}

function bitwiseEnumToArray(flags: number, enumValues: Record<number, string>) {
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
