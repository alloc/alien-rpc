import { ts } from '@ts-morph/common'
import {
  getArrayElementType,
  getTupleElements,
  isInterfaceType,
  isLibSymbol,
  isObjectType,
  isType,
  isTypeReference,
} from './utils.js'
import type { CompilerAPI } from './wrap.js'

export type ReferencedTypes = Map<ts.Symbol, string>

export function printTypeLiteralToString(
  ts: CompilerAPI,
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  referencedTypes?: ReferencedTypes,
  symbolStack: string[] = []
): string {
  if (referencedTypes) {
    collectReferencedTypes(ts, type, typeChecker, referencedTypes, symbolStack)
  }

  if (type.aliasSymbol && !symbolStack.includes(type.aliasSymbol.name)) {
    return type.aliasSymbol.name
  }

  if (isTypeReference(type)) {
    const typeArguments = typeChecker.getTypeArguments(type)
    if (typeArguments.length > 0) {
      return typeChecker.typeToString(type)
    }
  }

  return typeChecker.typeToString(
    type,
    undefined,
    ts.TypeFormatFlags.NoTruncation |
      ts.TypeFormatFlags.InTypeAlias |
      ts.TypeFormatFlags.UseStructuralFallback |
      ts.TypeFormatFlags.AllowUniqueESSymbolType |
      ts.TypeFormatFlags.WriteArrowStyleSignature |
      ts.TypeFormatFlags.WriteTypeArgumentsOfSignature
  )
}

const typeConstraintFileRegex = /\/@?alien-rpc\/.+?\/constraint\.d\.ts$/

export function collectReferencedTypes(
  ts: CompilerAPI,
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  referencedTypes: ReferencedTypes,
  symbolStack: string[]
) {
  const instanceSymbol = type.aliasSymbol ?? type.symbol

  const declarations = instanceSymbol?.getDeclarations()
  const declaration = declarations?.[0]

  // Skip type constraints.
  const declarationFile = declaration?.getSourceFile()
  if (typeConstraintFileRegex.test(declarationFile?.fileName ?? '')) {
    return
  }

  const referencedSymbol =
    declaration && getDeclarationSymbol(ts, declaration, typeChecker)

  const recursive = !(
    (instanceSymbol && symbolStack.includes(instanceSymbol.name)) ||
    (referencedSymbol && symbolStack.includes(referencedSymbol.name))
  )

  if (recursive) {
    const symbol = referencedSymbol ?? instanceSymbol
    const pushed = pushSymbol(symbolStack, symbol)

    for (const nestedType of visitNestedTypes(type, typeChecker)) {
      collectReferencedTypes(
        ts,
        nestedType,
        typeChecker,
        referencedTypes,
        symbolStack
      )
    }

    if (
      symbol &&
      symbol === referencedSymbol &&
      isType(symbol) &&
      !isLibSymbol(symbol) &&
      !referencedTypes.has(symbol)
    ) {
      let typeString = `export type ${symbol.name} = `
      if (isInterfaceType(symbol)) {
        typeString += '{\n'
        for (const propertySymbol of typeChecker.getPropertiesOfType(type)) {
          typeString +=
            '  ' +
            propertySymbol.name +
            ': ' +
            printTypeLiteralToString(
              ts,
              typeChecker.getTypeOfSymbol(propertySymbol),
              typeChecker,
              referencedTypes,
              symbolStack
            ) +
            '\n'
        }
        typeString += '}'
      } else {
        typeString += printTypeLiteralToString(
          ts,
          type,
          typeChecker,
          referencedTypes,
          symbolStack
        )
      }

      referencedTypes.set(symbol, typeString)
    }

    if (pushed) {
      symbolStack.pop()
    }
  }
}

function* visitNestedTypes(type: ts.Type, typeChecker: ts.TypeChecker) {
  if (type.isUnion()) {
    yield* type.types
  } else if (type.isIntersection()) {
    yield* type.types
  } else if (typeChecker.isTupleType(type)) {
    for (const elementSymbol of getTupleElements(type)) {
      yield typeChecker.getTypeOfSymbol(elementSymbol)
    }
  } else if (typeChecker.isArrayType(type)) {
    yield getArrayElementType(type)
  } else {
    const callSignatures = type.getCallSignatures()
    if (callSignatures.length > 0) {
      for (const signature of callSignatures) {
        for (const parameter of signature.getParameters()) {
          yield typeChecker.getTypeOfSymbol(parameter)
        }
        yield typeChecker.getReturnTypeOfSignature(signature)
      }
    } else {
      const symbol = type.aliasSymbol ?? type.symbol

      if (isTypeReference(type)) {
        for (const typeArgument of typeChecker.getTypeArguments(type)) {
          yield typeArgument
        }
      }

      if (symbol && !isLibSymbol(symbol) && isObjectType(type)) {
        for (const propertySymbol of typeChecker.getPropertiesOfType(type)) {
          yield typeChecker.getTypeOfSymbol(propertySymbol)
        }
        const stringIndexType = type.getStringIndexType()
        if (stringIndexType) {
          yield stringIndexType
        }
        const numberIndexType = type.getNumberIndexType()
        if (numberIndexType) {
          yield numberIndexType
        }
      }
    }
  }
}

function getReferencedSymbol(
  ts: CompilerAPI,
  symbol: ts.Symbol,
  typeChecker: ts.TypeChecker
) {
  const declarations = symbol.getDeclarations()
  const declaration = declarations?.[0]
  return declaration ? getDeclarationSymbol(ts, declaration, typeChecker) : null
}

function getDeclarationSymbol(
  ts: CompilerAPI,
  decl: ts.Declaration,
  typeChecker: ts.TypeChecker
) {
  const id = ts.isInterfaceDeclaration(decl)
    ? decl.name
    : decl.forEachChild(child => (ts.isIdentifier(child) ? child : undefined))

  return id && typeChecker.getSymbolAtLocation(id)
}

function isExportedDeclaration(ts: CompilerAPI, node: ts.Declaration) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
}

function pushSymbol(symbolStack: string[], symbol: ts.Symbol | undefined) {
  if (symbol && symbol.name !== '__type') {
    symbolStack.push(symbol.name)
    return true
  }
  return false
}
