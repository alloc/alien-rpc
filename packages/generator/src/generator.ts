import type { TObject, TSchema } from '@sinclair/typebox'
import { ts } from '@ts-morph/bootstrap'
import { jumpgen } from 'jumpgen'
import path from 'path'
import * as RoutePath from 'path-to-regexp'
import { camel, isString, sift } from 'radashi'
import { extractRoutes } from './extract-routes.js'
import { parseRoutes } from './parse-routes.js'
import { TypeScriptToTypeBox } from './typebox-codegen/typescript/generator.js'

export type Options = {
  /**
   * Your API's current version. There is no convention for what this
   * should be, but using the release date (e.g. `2024-10-31`) or a
   * semantic major version (e.g. `v1` or `v2`) are popular choices. Note
   * that its value is prefixed to every route pathname, so `/foo` becomes
   * `/v1/foo`.
   *
   * If not defined, the API won't be versioned, which means breaking
   * changes to your API could break active sessions in your client
   * application.
   */
  version?: string
  /**
   * Paths to modules that export route definitions. Glob patterns are
   * allowed. Negated glob patterns (e.g. `!foo`) are also supported.
   */
  include: string | string[]
  /**
   * The directory to output the generated files.
   */
  outDir: string
  /**
   * @default 'server/api.ts'
   */
  serverOutFile?: string
  /**
   * @default 'client/api.ts'
   */
  clientOutFile?: string
}

export default (options: Options) =>
  jumpgen('alien-rpc', async ({ write, scan, dedent, root, File }) => {
    const files = scan(options.include, {
      cwd: root,
      absolute: true,
    }).map(path => {
      return new File(path)
    })

    const routes = extractRoutes(await parseRoutes(files))

    if (options.version) {
      for (const route of routes) {
        route.resolvedPathname = `/${options.version}${route.resolvedPathname}`
      }
    }

    options = { ...options }

    options.serverOutFile ??= 'server/api.ts'
    options.serverOutFile = path.join(options.outDir, options.serverOutFile)

    options.clientOutFile ??= 'client/api.ts'
    options.clientOutFile = path.join(options.outDir, options.clientOutFile)

    const serverDefinitions: string[] = []
    const clientDefinitions: string[] = []
    const clientImports = new Set<string>(['RequestOptions', 'RpcRoute'])
    const clientFormats = new Set<string>()

    for (const route of routes) {
      const requestSchemaDecl = generateRuntimeValidator(
        `type Request = ${route.resolvedArguments[1]}`
      )
      const responseSchemaDecl = generateRuntimeValidator(
        `type Response = ${route.resolvedResult}`
      )

      let jsonEncodedParams: string[] | undefined

      if (route.resolvedMethod === 'get') {
        const { Type, KindGuard } = await import('@sinclair/typebox')

        /**
         * Find a schema that matches the predicate. Recurse into any
         * encountered union schemas.
         */
        const reduceTypeUnion = <T>(
          schema: TSchema,
          reduce: (currentValue: T, schema: TSchema) => T,
          currentValue: T
        ): T =>
          KindGuard.IsUnion(schema)
            ? schema.anyOf.reduce(
                (currentValue, variant) =>
                  reduceTypeUnion(variant, reduce, currentValue),
                currentValue
              )
            : reduce(currentValue, schema)

        const isStringType = (schema: TSchema): boolean =>
          isString(schema.type) && schema.type === 'string'

        // Instantiate the request schema so we can check if any properties
        // need JSON encoding.
        const requestSchema = new Function(
          'Type',
          'return ' + requestSchemaDecl
        )(Type) as TObject

        jsonEncodedParams = []

        for (const key in requestSchema.properties) {
          const propertySchema = requestSchema.properties[key]

          if (isStringType(propertySchema)) {
            // Simple string types don't need JSON encoding.
            continue
          }

          // If a property can be either a string or a non-string, we need
          // to encode string values as JSON.
          let foundString = false
          let foundNonString = false

          const reducer = (done: boolean, schema: TSchema) => {
            if (done) {
              return done
            }
            if (isStringType(schema)) {
              foundString ||= true
            } else {
              foundNonString ||= true
            }
            return foundString && foundNonString
          }

          if (reduceTypeUnion(propertySchema, reducer, false)) {
            jsonEncodedParams.push(key)
          }
        }
      }

      const handlerPath = resolveImportPath(
        path.join(root, options.serverOutFile),
        route.fileName.replace(/\.ts$/, '.js')
      )

      const pathParams = parseRoutePathParams(route.resolvedPathname)

      const sharedProperties = sift([
        `method: "${route.resolvedMethod}"`,
        jsonEncodedParams && `jsonParams: ${JSON.stringify(jsonEncodedParams)}`,
        pathParams.length && `pathParams: ${JSON.stringify(pathParams)}`,
      ])

      const serverPathname =
        route.resolvedPathname[0] === '/'
          ? route.resolvedPathname
          : `/${route.resolvedPathname}`

      const serverProperties = [
        `path: "${serverPathname}"`,
        ...sharedProperties,
        `import: async () => (await import(${JSON.stringify(handlerPath)})).${route.exportedName}.handler`,
        `format: "${route.resolvedFormat}"`,
        `requestSchema: ${requestSchemaDecl}`,
        `responseSchema: ${responseSchemaDecl}`,
      ]

      serverDefinitions.push(`{${serverProperties.join(', ')}}`)

      const resolvedPathParams = route.resolvedArguments[0]
      const resolvedExtraParams = route.resolvedArguments[1]

      const expectsParams =
        resolvedPathParams !== 'Record<string, never>' ||
        resolvedExtraParams !== 'Record<string, never>'

      const optionalParams =
        !expectsParams ||
        (arePropertiesOptional(resolvedPathParams) &&
          arePropertiesOptional(resolvedExtraParams))

      const clientArgs: string[] = ['requestOptions?: RequestOptions']
      if (expectsParams) {
        clientImports.add('RequestParams')
        clientArgs.unshift(
          `params${optionalParams ? '?' : ''}: RequestParams<${resolvedPathParams}, ${resolvedExtraParams}>${optionalParams ? ' | null' : ''}`
        )
      }

      let clientReturn: string
      if (route.resolvedFormat === 'json-seq') {
        clientImports.add('ResponseStream')
        clientReturn = route.resolvedResult.replace(/^\w+/, 'ResponseStream')
      } else if (route.resolvedFormat === 'json') {
        clientReturn = `Promise<${route.resolvedResult}>`
      } else if (route.resolvedFormat === 'response') {
        clientImports.add('ResponsePromise')
        clientReturn = 'ResponsePromise'
      } else {
        throw new Error(`Unsupported response format: ${route.resolvedFormat}`)
      }

      const description =
        route.description &&
        `/**\n${route.description.replace(/^/gm, ' * ')}\n */\n`

      // Ky doesn't support leading slashes in pathnames.
      const clientPathname =
        route.resolvedPathname[0] === '/'
          ? route.resolvedPathname.slice(1)
          : route.resolvedPathname

      const clientProperties = [
        `path: "${clientPathname}"`,
        ...sharedProperties,
        `arity: ${expectsParams ? 2 : 1}`,
        `format: ${
          /^json-seq$/.test(route.resolvedFormat)
            ? camel(route.resolvedFormat)
            : `"${route.resolvedFormat}"`
        }`,
      ]

      clientFormats.add(route.resolvedFormat)
      clientDefinitions.push(
        (description || '') +
          `export const ${route.exportedName} = {${clientProperties.join(', ')}} as RpcRoute<"${clientPathname}", (${clientArgs.join(', ')}) => ${clientReturn}>`
      )
    }

    const writeServerDefinitions = (outFile: string) => {
      const content = dedent/* ts */ `
        import { Type } from "@sinclair/typebox"

        export default [${serverDefinitions.join(', ')}] as const
      `

      write(outFile, content)
    }

    const writeClientDefinitions = (outFile: string) => {
      let imports = ''

      // Delete the two formats that are always available.
      clientFormats.delete('json')
      clientFormats.delete('response')

      if (clientFormats.size > 0) {
        imports += Array.from(
          clientFormats,
          format =>
            `\nimport ${camel(format)} from '@alien-rpc/client/formats/${format}'`
        ).join('')
      }

      const content = dedent/* ts */ `
        import { ${[...clientImports].sort().join(', ')} } from '@alien-rpc/client'${imports}

        ${clientDefinitions.join('\n\n')}
      `

      write(outFile, content)
    }

    writeServerDefinitions(options.serverOutFile)
    writeClientDefinitions(options.clientOutFile)
  })

function generateRuntimeValidator(code: string) {
  const generatedCode = TypeScriptToTypeBox.Generate(code, {
    useTypeBoxImport: false,
    useEmitConstOnly: true,
  })

  const sourceFile = ts.createSourceFile(
    'validator.ts',
    generatedCode,
    ts.ScriptTarget.Latest,
    true
  )

  const constStatement = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      statement.declarationList.declarations[0].initializer !== undefined
  )

  if (constStatement) {
    const initializer =
      constStatement.declarationList.declarations[0].initializer
    if (initializer) {
      return initializer.getText()
    }
  }

  throw new Error('Failed to parse TypeBox validator')
}

function resolveImportPath(fromPath: string, toPath: string) {
  let result = path
    .relative(path.dirname(fromPath), toPath)
    .replace(/\.ts$/, '.js')

  if (!result.startsWith('..')) {
    result = './' + result
  }
  return result
}

function arePropertiesOptional(objectLiteralType: string): boolean {
  const typeNode = parseTypeLiteral(objectLiteralType)
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.every(member => {
      if (ts.isPropertySignature(member)) {
        return member.questionToken !== undefined
      }
      return false
    })
  }
  return false
}

function parseTypeLiteral(type: string) {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    `type Temp = ${type}`,
    ts.ScriptTarget.Latest
  )
  return (sourceFile.statements[0] as ts.TypeAliasDeclaration).type
}

function parseRoutePathParams(pathname: string) {
  return RoutePath.parse(pathname).tokens.flatMap(function stringifyToken(
    token: RoutePath.Token
  ): string | string[] {
    switch (token.type) {
      case 'param':
      case 'wildcard':
        return token.name
      case 'group':
        return token.tokens.flatMap(stringifyToken)
      case 'text':
        return []
    }
  })
}
