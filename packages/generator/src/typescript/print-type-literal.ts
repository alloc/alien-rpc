import { ts } from '@ts-morph/common'
import {
  getArrayElementType,
  getTupleElements,
  isInterfaceType,
  isLibSymbol,
  isObjectType,
  isTypeAlias,
  isUndefinedType,
  iterableToString,
} from './utils.js'

export interface PrintTypeLiteralOptions {
  omitUndefinedLiteral?: boolean
}

export function printTypeLiteralToString(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions = {},
  seen = new Set<ts.Type>()
) {
  return iterableToString(printTypeLiteral(type, typeChecker, opts, seen))
}

/**
 * Convert a given type to its string representation, resolving any type
 * names into type literals (recursively).
 */
export function* printTypeLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions = {},
  seen = new Set<ts.Type>()
): Generator<string> {
  if (seen.has(type)) {
    yield typeChecker.typeToString(type)
  } else {
    seen.add(type)

    if (type.isUnion()) {
      yield* printUnionLiteral(type, typeChecker, opts, seen)
    } else if (type.isIntersection()) {
      yield* printIntersectionLiteral(type, typeChecker, opts, seen)
    } else if (typeChecker.isTupleType(type)) {
      yield* printTupleLiteral(type, typeChecker, opts, seen)
    } else if (typeChecker.isArrayType(type)) {
      yield* printArrayLiteral(type, typeChecker, opts, seen)
    } else {
      const typeSymbol = type.getSymbol()
      if (!typeSymbol || isLibSymbol(typeSymbol)) {
        yield typeChecker.typeToString(type)
      } else if (isTypeAlias(typeSymbol)) {
        yield* printTypeLiteral(type, typeChecker, opts, seen)
      } else if (isObjectType(typeSymbol) || isInterfaceType(typeSymbol)) {
        yield* printObjectTypeLiteral(type, typeChecker, opts, seen)
      } else {
        yield typeChecker.typeToString(type)
      }
    }
  }
}

function* printUnionLiteral(
  type: ts.UnionType,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions,
  seen: Set<ts.Type>
) {
  const variants = opts.omitUndefinedLiteral
    ? type.types.filter(variant => !isUndefinedType(variant))
    : type.types

  for (let i = 0; i < variants.length; i++) {
    if (i > 0) {
      yield ' | '
    }
    yield* printTypeLiteral(variants[i], typeChecker, opts, seen)
  }
}

function* printIntersectionLiteral(
  type: ts.IntersectionType,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions,
  seen: Set<ts.Type>
) {
  for (let i = 0; i < type.types.length; i++) {
    if (i > 0) {
      yield ' & '
    }
    yield* printTypeLiteral(type.types[i], typeChecker, opts, seen)
  }
}

function* printArrayLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions,
  seen: Set<ts.Type>
) {
  yield 'Array<'
  yield* printTypeLiteral(getArrayElementType(type), typeChecker, opts, seen)
  yield '>'
}

function* printTupleLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions,
  seen: Set<ts.Type>
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
      opts,
      seen
    )
  }
  yield ']'
}

function* printObjectTypeLiteral(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  opts: PrintTypeLiteralOptions,
  seen: Set<ts.Type>
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
      opts,
      seen
    )
  }

  const stringIndexType = type.getStringIndexType()
  if (stringIndexType) {
    if (++i > 1) {
      yield '; '
    }
    yield '[key: string]: '
    yield* printTypeLiteral(stringIndexType, typeChecker, opts, seen)
    yield ']'
  }

  const numberIndexType = type.getNumberIndexType()
  if (numberIndexType) {
    if (++i > 1) {
      yield '; '
    }
    yield '[index: number]: '
    yield* printTypeLiteral(numberIndexType, typeChecker, opts, seen)
    yield ']'
  }

  yield ' }'
}
