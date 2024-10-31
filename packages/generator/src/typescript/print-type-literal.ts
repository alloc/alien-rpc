import { ts } from '@ts-morph/common'
import {
  isBuiltInType,
  isInterfaceType,
  isObjectType,
  isTypeAlias,
  isUndefinedType,
} from './utils.js'

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

  if (typeChecker.isArrayType(type)) {
    const typeArguments = (type as ts.TypeReference).typeArguments
    if (typeArguments && typeArguments.length > 0) {
      return `Array<${printTypeLiteral(typeArguments[0], typeChecker, opts, seen)}>`
    }
  }

  if (isBuiltInType(type)) {
    return typeChecker.typeToString(type)
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
