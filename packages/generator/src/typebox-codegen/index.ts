import type { ts } from '@ts-morph/common'
import { camel } from 'radashi'

export type { Options as TypeScriptToTypeBoxOptions }

interface Options {
  /**
   * Setting this to true will ensure all types are exports as const
   * values. This setting is used by the TypeScriptToTypeBoxModel to gather
   * TypeBox definitions during runtime eval pass.
   * @default false
   */
  exportEverything?: boolean
  /**
   * Specifies if the output code should specify a default `import`
   * statement. For TypeScript generated code this is typically desirable,
   * but for Model generated code, the `Type` build is passed in into scope
   * as a variable.
   * @default true
   */
  includeTypeBoxImport?: boolean
  /**
   * Specifies if the output types should include an identifier associated
   * with the assigned variable name. This is useful for remapping model
   * types to targets, but optional for for TypeBox which can operate on
   * vanilla JS references.
   * @default false
   */
  useIdentifiers?: boolean
  /**
   * Specifies if the output code should include only `const` statements.
   * In other words, the `type` declarations aren't emitted.
   * @default false
   */
  emitConstOnly?: boolean
  /**
   * If any intersected type has a name that matches one of these strings, it will be treated as a type option.
   */
  typeTags?: string[]
}

export function generateTypes(
  ts: CompilerAPI,
  code: string,
  options: Options
): string {
  const sourceFile = ts.createSourceFile(
    'types.ts',
    code,
    ts.ScriptTarget.ESNext,
    true
  )

  return processSourceFile(ts, sourceFile, {
    exportEverything: options.exportEverything ?? false,
    useIdentifiers: options.useIdentifiers ?? false,
    includeTypeBoxImport: options.includeTypeBoxImport ?? true,
    emitConstOnly: options.emitConstOnly ?? false,
    typeTags: options.typeTags ?? [],
  })
}

/** Processes a TypeScript source file */
function processSourceFile(
  ts: CompilerAPI,
  sourceFile: ts.SourceFile,
  options: Required<Options>
): string {
  /**
   * Tracked on calls to find type name
   */
  const typenames = new Set<string>()
  /**
   * Tracked for recursive types and used to associate `This` type
   * references.
   */
  let recursiveDeclaration:
    | ts.TypeAliasDeclaration
    | ts.InterfaceDeclaration
    | null = null
  /**
   * Tracked for scoped block level definitions and used to prevent
   * `export` emit when not in global scope.
   */
  let blockLevel = 0
  /**
   * Tracked for injecting `typebox` import statements
   */
  let useImports = false
  /**
   * Tracked for injecting “JSON Schema” options
   */
  let useOptions = false
  /**
   * Tracked for injecting `TSchema` import statements
   */
  let useGenerics = false
  /**
   * Tracked for cases where composition requires deep clone
   */
  let useCloneType = false

  const declarations = [...lazyRender(sourceFile)].join('\n\n')
  if (useImports && options.includeTypeBoxImport) {
    return [generateTypeBoxImport(), '', '', declarations].join('\n')
  }
  return declarations

  function renderTypeTags(
    tagNodes: ts.TypeReferenceNode[] | undefined,
    prefix: string = ''
  ): string {
    if (!tagNodes || tagNodes.length === 0) {
      return ''
    }
    let properties = ''
    for (const tagNode of tagNodes) {
      const name = camel(tagNode.getChildAt(0).getText())
      const value = tagNode.typeArguments?.[0].getText() ?? 'true'
      if (properties) properties += ', '
      properties += `${name}: ${value}`
    }
    return prefix + '{ ' + properties + ' }'
  }

  function* renderIndexSignature(node: ts.IndexSignatureDeclaration) {
    // Note: We ignore the key and just return the type. This is a mismatch
    // between object and record types. We'll have to address this in
    // TypeBox by unifying validation paths for objects and record types.
    yield render(node.type)
  }

  function renderTypeProperties(members: ts.NodeArray<ts.TypeElement>): string {
    const properties = members.filter(ts.isPropertySignature)
    const indexSignature = members.filter(ts.isIndexSignatureDeclaration).at(-1)

    if (properties.length) {
      return (
        `{\n${properties
          .map(node => {
            const type = render(node.type)
            const modifier = isReadonlyProperty(node)
              ? isOptionalProperty(node)
                ? 'ReadonlyOptional'
                : 'Readonly'
              : isOptionalProperty(node)
                ? 'Optional'
                : null

            return modifier
              ? `${node.name.getText()}: Type.${modifier}(${type})`
              : `${node.name.getText()}: ${type}`
          })
          .join(',\n')}\n}` +
        (indexSignature
          ? `,\n{\nadditionalProperties: ${renderIndexSignature(indexSignature)}\n }`
          : '')
      )
    }

    if (properties.length === 0 && indexSignature) {
      return `{},\n{\nadditionalProperties: ${renderIndexSignature(indexSignature)}\n }`
    }
    return ''
  }

  function renderName(node: { name: ts.Identifier }) {
    return node.name.getText()
  }

  function renderPotentiallyGenericType(
    node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
    type: string
  ) {
    const exports = isExport(node) ? 'export ' : ''
    const typeName = node.name.getText()

    let staticTypeName: string | undefined
    let staticReference: string | undefined

    if (node.typeParameters) {
      useGenerics = true

      const names = node.typeParameters.map(renderName)
      const constraints = names
        .map(name => `${name} extends TSchema`)
        .join(', ')

      type = `<${constraints}>(${names.map(name => `${name}: ${name}`).join(', ')}) => ${type}`

      if (!options.emitConstOnly) {
        staticTypeName = `${typeName}<${constraints}>`
        staticReference = `ReturnType<typeof ${typeName}<${names.join(', ')}>>`
      }
    } else if (!options.emitConstOnly) {
      staticTypeName = typeName
      staticReference = !options.emitConstOnly && `typeof ${typeName}`
    }

    const staticDeclaration =
      !options.emitConstOnly &&
      `${exports}type ${staticTypeName} = Static<${staticReference}>`

    const typeDeclaration = `${exports}const ${typeName} = ${type}`

    return join(staticDeclaration, typeDeclaration)
  }

  function render(node: ts.Node | undefined): string {
    return `${[...lazyRender(node)].join('')}`
  }

  function* lazyRender(
    node: ts.Node | undefined,
    tagNodes?: ts.TypeReferenceNode[] | undefined
  ): IterableIterator<string> {
    if (node === undefined) {
      return
    }

    // Type.Array
    if (ts.isArrayTypeNode(node)) {
      const elementType = render(node.elementType)

      yield `Type.Array(${elementType}${renderTypeTags(tagNodes, ', ')})`
    }

    // Type.Extends
    else if (ts.isConditionalTypeNode(node)) {
      const checkType = render(node.checkType)
      const extendsType = render(node.extendsType)
      const trueType = render(node.trueType)
      const falseType = render(node.falseType)

      yield `Type.Extends(${checkType}, ${extendsType}, ${trueType}, ${falseType})`
    }

    // Type.Enum
    else if (ts.isEnumDeclaration(node)) {
      useImports = true

      const exports = isExport(node) ? 'export ' : ''
      const members = node.members.map(member => member.getText()).join(', ')
      const enumType = `${exports}enum Enum${node.name.getText()} { ${members} }`

      const staticType =
        !options.emitConstOnly &&
        `${exports}type ${node.name.getText()} = Static<typeof ${node.name.getText()}>`

      const type = `${exports}const ${node.name.getText()} = Type.Enum(Enum${node.name.getText()})`

      yield join(enumType, '', staticType, type)
    }

    // Type.Index
    else if (ts.isIndexedAccessTypeNode(node)) {
      const obj = node.objectType.getText()
      const key = render(node.indexType)

      yield `Type.Index(${obj}, ${key})`
    }

    // Type.Object (maybe also Type.Recursive and/or Type.Composite)
    else if (ts.isInterfaceDeclaration(node)) {
      useImports = true
      if (isTypeRecursive(node)) {
        recursiveDeclaration = node
      }

      const heritage = node.heritageClauses
        ? node.heritageClauses.map(node =>
            node.types.map(node => render(node)).join(', ')
          )
        : []

      const members = renderTypeProperties(node.members)

      const rawTypeExpression = recursiveDeclaration
        ? `Type.Recursive(This => Type.Object(${members}))`
        : `Type.Object(${members})`

      yield renderPotentiallyGenericType(
        node,
        heritage.length === 0
          ? rawTypeExpression
          : `Type.Composite([${heritage.join(', ')}, ${rawTypeExpression}])`
      )

      recursiveDeclaration = null
    }

    // Type.Intersect
    else if (ts.isIntersectionTypeNode(node)) {
      const typeNodes: ts.TypeNode[] = []
      let tagNodes: ts.TypeReferenceNode[] | undefined
      for (const type of node.types) {
        if (
          ts.isTypeReferenceNode(type) &&
          options.typeTags.includes(type.getChildAt(0).getText())
        ) {
          tagNodes ??= []
          tagNodes.push(type)
        } else {
          typeNodes.push(type)
        }
      }
      if (typeNodes.length === 0) {
        throw new Error('Type cannot only contain type tags')
      }
      if (typeNodes.length > 1) {
        const types = typeNodes.map(type => render(type)).join(',\n')
        yield `Type.Intersect([\n${types}\n]${renderTypeTags(tagNodes, ', ')})`
      } else {
        yield* lazyRender(typeNodes[0], tagNodes)
      }
    }

    // Type.Literal or Type.Null
    else if (ts.isLiteralTypeNode(node)) {
      const text = node.getText()
      if (text === 'null') {
        yield `Type.Null()`
      } else {
        yield `Type.Literal(${node.getText()})`
      }
    }

    // Type.Mapped
    else if (ts.isMappedTypeNode(node)) {
      const K = render(node.typeParameter)
      const T = render(node.type)
      const C = render(node.typeParameter.constraint)

      const readonly = node.readonlyToken !== undefined
      const optional = node.questionToken !== undefined

      const readonly_subtractive =
        readonly && ts.isMinusToken(node.readonlyToken)
      const optional_subtractive =
        optional && ts.isMinusToken(node.questionToken)

      yield readonly && optional
        ? readonly_subtractive && optional_subtractive
          ? `Type.Mapped(${C}, ${K} => Type.Readonly(Type.Optional(${T}, false), false))`
          : readonly_subtractive
            ? `Type.Mapped(${C}, ${K} => Type.Readonly(Type.Optional(${T}), false))`
            : optional_subtractive
              ? `Type.Mapped(${C}, ${K} => Type.Readonly(Type.Optional(${T}, false)))`
              : `Type.Mapped(${C}, ${K} => Type.Readonly(Type.Optional(${T})))`
        : readonly
          ? readonly_subtractive
            ? `Type.Mapped(${C}, ${K} => Type.Readonly(${T}, false))`
            : `Type.Mapped(${C}, ${K} => Type.Readonly(${T}))`
          : optional
            ? optional_subtractive
              ? `Type.Mapped(${C}, ${K} => Type.Optional(${T}, false))`
              : `Type.Mapped(${C}, ${K} => Type.Optional(${T}))`
            : `Type.Mapped(${C}, ${K} => ${T})`
    }

    // Type.Tuple
    else if (ts.isTupleTypeNode(node)) {
      yield `Type.Tuple([\n${node.elements.map(type => render(type)).join(',\n')}\n])`
    }

    // Type.TemplateLiteral
    else if (ts.isTemplateLiteralTypeNode(node)) {
      yield `Type.TemplateLiteral([${node
        .getChildren()
        .flatMap(node => {
          if (ts.isTemplateLiteralTypeSpan(node)) {
            const children = node.getChildren().flatMap(node => {
              if (ts.isTemplateMiddle(node)) {
                if (node.text.length > 0) {
                  return `Type.Literal('${node.text}')`
                }
              } else if (ts.isTemplateTail(node)) {
                if (node.text.length > 0) {
                  return `Type.Literal('${node.text}')`
                }
              } else {
                return render(node)
              }
              return []
            })

            if (children.length > 0) {
              return children.join(', ')
            }
          } else if (ts.isTemplateHead(node)) {
            if (node.text.length > 0) {
              return `Type.Literal('${node.text}')`
            }
          }
          return []
        })
        .join(', ')}])`
    }

    // Type.Object
    else if (ts.isTypeLiteralNode(node)) {
      const members = renderTypeProperties(node.members)
      yield* `Type.Object(${members})`
    }

    // Type.KeyOf, Type.Readonly
    else if (ts.isTypeOperatorNode(node)) {
      if (node.operator === ts.SyntaxKind.KeyOfKeyword) {
        const type = render(node.type)
        yield `Type.KeyOf(${type})`
      }
      if (node.operator === ts.SyntaxKind.ReadonlyKeyword) {
        yield `Type.Readonly(${render(node.type)})`
      }
    }

    // Type.Union
    else if (ts.isUnionTypeNode(node)) {
      yield `Type.Union([\n${node.types.map(type => render(type)).join(',\n')}\n])`
    }

    // Type References //
    else if (ts.isTypeReferenceNode(node)) {
      const name = node.typeName.getText()
      const args = node.typeArguments
        ? `(${node.typeArguments.map(type => render(type)).join(', ')}${renderTypeTags(tagNodes, ', ')})`
        : ''

      if (name === 'Date') {
        yield `Type.Date(${renderTypeTags(tagNodes)})`
      } else if (name === 'Uint8Array') {
        yield `Type.Uint8Array()`
      } else if (name === 'String') {
        yield `Type.String()`
      } else if (name === 'Number') {
        yield `Type.Number()`
      } else if (name === 'Boolean') {
        yield `Type.Boolean()`
      } else if (name === 'Function') {
        yield `Type.Any()`
      } else if (name === 'Array') {
        yield `Type.Array${args}`
      } else if (name === 'Record') {
        yield `Type.Record${args}`
      } else if (name === 'Partial') {
        yield `Type.Partial${args}`
      } else if (name === 'Required') {
        yield `Type.Required${args}`
      } else if (name === 'Omit') {
        yield `Type.Omit${args}`
      } else if (name === 'Pick') {
        yield `Type.Pick${args}`
      } else if (name === 'Promise') {
        yield `Type.Promise${args}`
      } else if (name === 'ReturnType') {
        yield `Type.ReturnType${args}`
      } else if (name === 'InstanceType') {
        yield `Type.InstanceType${args}`
      } else if (name === 'Parameters') {
        yield `Type.Parameters${args}`
      } else if (name === 'AsyncIterableIterator') {
        yield `Type.AsyncIterator${args}`
      } else if (name === 'IterableIterator') {
        yield `Type.Iterator${args}`
      } else if (name === 'ConstructorParameters') {
        yield `Type.ConstructorParameters${args}`
      } else if (name === 'Exclude') {
        yield `Type.Exclude${args}`
      } else if (name === 'Extract') {
        yield `Type.Extract${args}`
      } else if (name === 'Awaited') {
        yield `Type.Awaited${args}`
      } else if (name === 'Uppercase') {
        yield `Type.Uppercase${args}`
      } else if (name === 'Lowercase') {
        yield `Type.Lowercase${args}`
      } else if (name === 'Capitalize') {
        yield `Type.Capitalize${args}`
      } else if (name === 'Uncapitalize') {
        yield `Type.Uncapitalize${args}`
      } else if (
        recursiveDeclaration &&
        findRecursiveParent(recursiveDeclaration, node)
      ) {
        yield `This`
      } else if (
        findTypeName(node.getSourceFile(), name) &&
        args.length === 0 /** non-resolvable */
      ) {
        yield `${name}${args}`
      } else if (name in globalThis) {
        yield `Type.Never()`
      } else {
        yield `${name}${args}`
      }
    }

    // Keywords //
    else if (node.kind === ts.SyntaxKind.ExportKeyword) {
      yield `export`
    } else if (node.kind === ts.SyntaxKind.KeyOfKeyword) {
      yield `Type.KeyOf()`
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
      yield `Type.Number(${renderTypeTags(tagNodes)})`
    } else if (node.kind === ts.SyntaxKind.BigIntKeyword) {
      yield `Type.BigInt(${renderTypeTags(tagNodes)})`
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      yield `Type.String(${renderTypeTags(tagNodes)})`
    } else if (node.kind === ts.SyntaxKind.SymbolKeyword) {
      yield `Type.Symbol()`
    } else if (node.kind === ts.SyntaxKind.BooleanKeyword) {
      yield `Type.Boolean()`
    } else if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
      yield `Type.Undefined()`
    } else if (node.kind === ts.SyntaxKind.UnknownKeyword) {
      yield `Type.Unknown()`
    } else if (node.kind === ts.SyntaxKind.AnyKeyword) {
      yield `Type.Any()`
    } else if (node.kind === ts.SyntaxKind.NeverKeyword) {
      yield `Type.Never()`
    } else if (node.kind === ts.SyntaxKind.NullKeyword) {
      yield `Type.Null()`
    } else if (node.kind === ts.SyntaxKind.VoidKeyword) {
      yield `Type.Void()`
    } else if (node.kind === ts.SyntaxKind.SyntaxList) {
      for (const child of node.getChildren()) {
        yield* lazyRender(child)
      }
    }

    // Uncommon Nodes //
    else if (ts.isIdentifier(node)) {
      yield node.getText()
    } else if (ts.isModuleDeclaration(node)) {
      const export_specifier = isExport(node) ? 'export ' : ''
      const module_specifier = isNamespace(node) ? 'namespace' : 'module'
      yield `${export_specifier}${module_specifier} ${node.name.getText()} {`
      yield* lazyRender(node.body)
      yield `}`
    } else if (ts.isNamedTupleMember(node)) {
      yield* render(node.type)
    } else if (ts.isParenthesizedTypeNode(node)) {
      yield render(node.type)
    } else if (ts.isPropertyAccessExpression(node)) {
      yield node.getText()
    } else if (ts.isThisTypeNode(node)) {
      yield `This`
    } else if (ts.isTypeAliasDeclaration(node)) {
      useImports = true
      if (isTypeRecursive(node)) {
        recursiveDeclaration = node
      }
      yield renderPotentiallyGenericType(
        node,
        recursiveDeclaration
          ? `Type.Recursive(This => ${render(node.type)})`
          : render(node.type)
      )
      recursiveDeclaration = null
    } else if (ts.isTypeParameterDeclaration(node)) {
      yield node.name.getText()
    } else if (ts.isSourceFile(node)) {
      for (const next of node.getChildren()) {
        yield* lazyRender(next)
      }
    } else if (node.kind === ts.SyntaxKind.EndOfFileToken) {
      // ignore
    }

    // Rare Nodes //
    else if (ts.isBlock(node)) {
      blockLevel++

      const statements = node.statements
        .map(statement => render(statement))
        .join('\n\n')

      blockLevel--

      yield `{\n${statements}\n}`
    } else if (ts.isClassDeclaration(node)) {
      // ignore
    } else if (ts.isConstructorTypeNode(node)) {
      yield `Type.Any()`
    } else if (ts.isExpressionWithTypeArguments(node)) {
      const name = render(node.expression)
      const typeArguments =
        node.typeArguments === undefined
          ? []
          : node.typeArguments.map(node => render(node))

      // todo: default type argument (resolve `= number` from `type Foo<T = number>`)
      yield typeArguments.length === 0
        ? `${name}`
        : `${name}(${typeArguments.join(', ')})`
    } else if (ts.isFunctionDeclaration(node)) {
      // ignore
    } else if (ts.isFunctionTypeNode(node)) {
      yield `Type.Any()`
    } else if (ts.isMethodSignature(node)) {
      yield `${node.name.getText()}: Type.Any()`
    } else if (ts.isModuleBlock(node)) {
      for (const statement of node.statements) {
        yield* lazyRender(statement)
      }
    }

    // Unhandled Node //
    else {
      throw Error(
        `Unhandled node: ${ts.SyntaxKind[node.kind]} ${node.getText()}`
      )
    }
  }

  function generateTypeBoxImport(): string {
    const set = new Set<string>(['Type', 'Static'])
    if (useGenerics) {
      set.add('TSchema')
    }
    if (useOptions) {
      set.add('SchemaOptions')
    }
    if (useCloneType) {
      set.add('CloneType')
    }
    const imports = [...set].join(', ')
    return `import { ${imports} } from '@sinclair/typebox'`
  }

  function findRecursiveParent(
    decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    node: ts.Node
  ): boolean {
    return (
      (ts.isTypeReferenceNode(node) &&
        decl.name.getText() === node.typeName.getText()) ||
      node.getChildren().some(node => findRecursiveParent(decl, node))
    )
  }

  function findRecursiveThis(node: ts.Node): boolean {
    return node
      .getChildren()
      .some(node => ts.isThisTypeNode(node) || findRecursiveThis(node))
  }

  function findTypeName(node: ts.Node, name: string): boolean {
    const found =
      typenames.has(name) ||
      node.getChildren().some(node => {
        return (
          ((ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node)) &&
            node.name.getText() === name) ||
          findTypeName(node, name)
        )
      })
    if (found) typenames.add(name)
    return found
  }

  function isTypeRecursive(
    decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration
  ) {
    const check1 = ts.isTypeAliasDeclaration(decl)
      ? [decl.type].some(node => findRecursiveParent(decl, node))
      : decl.members.some(node => findRecursiveParent(decl, node))
    const check2 = ts.isInterfaceDeclaration(decl) && findRecursiveThis(decl)
    return check1 || check2
  }

  function isReadonlyProperty(node: ts.PropertySignature): boolean {
    return (
      node.modifiers !== undefined &&
      node.modifiers.find(modifier => modifier.getText() === 'readonly') !==
        undefined
    )
  }

  function isOptionalProperty(node: ts.PropertySignature) {
    return node.questionToken !== undefined
  }

  function isOptionalParameter(node: ts.ParameterDeclaration) {
    return node.questionToken !== undefined
  }

  function isExport(
    node:
      | ts.InterfaceDeclaration
      | ts.TypeAliasDeclaration
      | ts.EnumDeclaration
      | ts.ModuleDeclaration
  ): boolean {
    return (
      blockLevel === 0 &&
      (options.exportEverything ||
        (node.modifiers !== undefined &&
          node.modifiers.find(modifier => modifier.getText() === 'export') !==
            undefined))
    )
  }

  function isNamespace(node: ts.ModuleDeclaration) {
    return node.flags === ts.NodeFlags.Namespace
  }

  function join(...statements: (string | false)[]): string {
    return statements.filter(Boolean).join('\n')
  }
}
