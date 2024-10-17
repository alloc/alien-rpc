import { ts } from '@ts-morph/common'

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
  const symbol = type.getSymbol()
  return Boolean(symbol && symbol.name === 'AsyncGenerator')
}

function isBuiltInType(type: ts.Type): boolean {
  const symbol = type.getSymbol()
  const declarations = symbol?.getDeclarations()
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

export interface ForEachDescendantTraversalControl {
  /**
   * Stops traversal.
   */
  stop(): void
  /**
   * Skips traversal of the current node's descendants.
   */
  skip(): void
  /**
   * Skips traversal of the current node, siblings, and all their descendants.
   */
  up(): void
}

// Taken from https://github.com/dsherret/ts-morph/blob/061a3febe2383c4f0df32ac1339294dfe3f1f851/packages/ts-morph/src/compiler/ast/common/Node.ts#L701
export function forEachDescendant<T>(
  node: ts.Node,
  cbNode: (
    node: ts.Node,
    traversal: ForEachDescendantTraversalControl
  ) => T | undefined,
  cbNodeArray?: (
    nodes: ts.NodeArray<ts.Node>,
    traversal: ForEachDescendantTraversalControl
  ) => T | undefined
): T | undefined {
  const stopReturnValue: any = {}
  const upReturnValue: any = {}

  let stop = false
  let up = false

  const traversal = {
    stop: () => (stop = true),
    up: () => (up = true),
  }

  const nodeCallback: (node: ts.Node) => T | undefined = (node: ts.Node) => {
    if (stop) return stopReturnValue

    let skip = false

    const returnValue = cbNode(node, {
      ...traversal,
      skip: () => (skip = true),
    })

    if (returnValue) return returnValue

    if (stop) return stopReturnValue

    if (skip || up) return undefined

    return forEachChildForNode(node)
  }

  const arrayCallback:
    | ((nodes: ts.NodeArray<ts.Node>) => T | undefined)
    | undefined =
    cbNodeArray == null
      ? undefined
      : (nodes: ts.NodeArray<ts.Node>) => {
          if (stop) return stopReturnValue

          let skip = false

          const returnValue = cbNodeArray(nodes, {
            ...traversal,
            skip: () => (skip = true),
          })

          if (returnValue) return returnValue

          if (skip) return undefined

          for (const node of nodes) {
            if (stop) return stopReturnValue
            if (up) return undefined

            const innerReturnValue = forEachChildForNode(node)
            if (innerReturnValue) return innerReturnValue
          }

          return undefined
        }

  const finalResult = forEachChildForNode(node)
  return finalResult === stopReturnValue ? undefined : finalResult

  function forEachChildForNode(node: ts.Node): T | undefined {
    const result = node.forEachChild<T>(
      innerNode => {
        const returnValue = nodeCallback(innerNode)
        if (up) {
          up = false
          return returnValue || upReturnValue
        }
        return returnValue
      },
      arrayCallback == null
        ? undefined
        : nodes => {
            const returnValue = arrayCallback(nodes)
            if (up) {
              up = false
              return returnValue || upReturnValue
            }
            return returnValue
          }
    )
    return result === upReturnValue ? undefined : result
  }
}
