import { ts } from '@ts-morph/common'
import {
  getArrayElementType,
  getTupleElements,
  isInterfaceType,
  isLibSymbol,
  isObjectLiteral,
  isTypeAlias,
  isUndefinedType,
  iterableToString,
} from './utils.js'

export interface PrintTypeLiteralOptions {
  omitUndefinedLiteral?: boolean
  /**
   * Collect referenced types instead of printing them as type literals.
   */
  referencedTypes?: Map<ts.Symbol, string>
  /**
   * @internal Indicates a symbol that must be printed as a type literal.
   */
  currentSymbol?: ts.Symbol
}

export function printTypeLiteralToString(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions = {}
) {
  return iterableToString(printTypeLiteral(type, typeChecker, opts))
}

const cacheGeneratedStrings = <
  Key extends object,
  T extends (key: Key, ...args: any[]) => Generator<string>,
>(
  fn: T,
  resultCache: WeakMap<Key, string[]> = new WeakMap()
) =>
  ((key: Key, ...args: any[]): Generator<string> => {
    if (resultCache.has(key)) {
      return (function* () {
        yield* resultCache.get(key)!
      })()
    }

    const generator = fn(key, ...args)
    const parts: string[] = []

    return (function* () {
      for (const value of generator) {
        parts.push(value)
        yield value
      }
      resultCache.set(key, parts)
    })()
  }) as T

/**
 * Convert a given type to its string representation, resolving any type
 * names into type literals (recursively).
 */
export const printTypeLiteral = cacheGeneratedStrings(
  function* printTypeLiteral(
    type: ts.Type,
    typeChecker: ts.TypeChecker,
    opts: PrintTypeLiteralOptions = {}
  ): Generator<string> {
    if (type.isUnion()) {
      yield* printUnionLiteral(type, typeChecker, opts)
    } else if (type.isIntersection()) {
      yield* printIntersectionLiteral(type, typeChecker, opts)
    } else if (typeChecker.isTupleType(type)) {
      yield* printTupleLiteral(type, typeChecker, opts)
    } else if (typeChecker.isArrayType(type)) {
      yield* printArrayLiteral(type, typeChecker, opts)
    } else {
      const typeSymbol = type.getSymbol()
      if (!typeSymbol || isLibSymbol(typeSymbol)) {
        return yield typeChecker.typeToString(type)
      }

      if (
        type.aliasSymbol &&
        opts.referencedTypes &&
        opts.currentSymbol !== type.aliasSymbol
      ) {
        const declarations = type.aliasSymbol.getDeclarations()
        if (!declarations) {
          throw new Error('Type alias declaration not found')
        }

        const typeAlias = typeChecker.getTypeOfSymbol(
          type.aliasSymbol
        ) as ts.TypeReference

        const typeArguments = typeChecker.getTypeArguments(typeAlias)
        if (typeArguments.length > 0) {
          // TODO: Support generic type aliases
          yield* printTypeLiteral(type, typeChecker, opts)
        } else {
          yield type.aliasSymbol.name

          if (!opts.referencedTypes.has(type.aliasSymbol)) {
            opts.referencedTypes.set(
              type.aliasSymbol,
              printTypeLiteralToString(type, typeChecker, {
                ...opts,
                currentSymbol: type.aliasSymbol,
              })
            )
          }
        }
      } else if (isTypeAlias(typeSymbol)) {
        yield* printTypeLiteral(type, typeChecker, opts)
      } else if (isObjectLiteral(typeSymbol) || isInterfaceType(typeSymbol)) {
        yield* printObjectTypeLiteral(type, typeChecker, opts)
      } else {
        yield typeChecker.typeToString(type)
      }
    }
  }
)

function* printUnionLiteral(
  type: ts.UnionType,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions
) {
  const variants = opts.omitUndefinedLiteral
    ? type.types.filter(variant => !isUndefinedType(variant))
    : type.types

  for (let i = 0; i < variants.length; i++) {
    if (i > 0) {
      yield ' | '
    }
    yield* printTypeLiteral(variants[i], typeChecker, opts)
  }
}

function* printIntersectionLiteral(
  type: ts.IntersectionType,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions
) {
  for (let i = 0; i < type.types.length; i++) {
    if (i > 0) {
      yield ' & '
    }
    yield* printTypeLiteral(type.types[i], typeChecker, opts)
  }
}

function* printArrayLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions
) {
  yield 'Array<'
  yield* printTypeLiteral(getArrayElementType(type), typeChecker, opts)
  yield '>'
}

function* printTupleLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions
) {
  yield '['
  let i = 0
  for (const element of getTupleElements(type)) {
    if (++i > 1) {
      yield ', '
    }
    yield* printTypeLiteral(
      typeChecker.getTypeOfSymbol(element),
      typeChecker,
      opts
    )
  }
  yield ']'
}

function* printObjectTypeLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions
) {
  yield '{ '

  let i = 0

  for (const prop of type.getProperties()) {
    if (++i > 1) {
      yield '; '
    }
    yield prop.name
    if (prop.flags & ts.SymbolFlags.Optional) {
      yield '?'
    }
    yield ': '
    yield* printTypeLiteral(
      typeChecker.getTypeOfSymbol(prop),
      typeChecker,
      opts
    )
  }

  const stringIndexType = type.getStringIndexType()
  if (stringIndexType) {
    if (++i > 1) {
      yield '; '
    }
    yield '[key: string]: '
    yield* printTypeLiteral(stringIndexType, typeChecker, opts)
    yield ']'
  }

  const numberIndexType = type.getNumberIndexType()
  if (numberIndexType) {
    if (++i > 1) {
      yield '; '
    }
    yield '[index: number]: '
    yield* printTypeLiteral(numberIndexType, typeChecker, opts)
    yield ']'
  }

  yield ' }'
}
