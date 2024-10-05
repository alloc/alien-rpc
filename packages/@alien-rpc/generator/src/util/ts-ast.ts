import ts from 'typescript'

export function getFullyQualifiedType(
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
