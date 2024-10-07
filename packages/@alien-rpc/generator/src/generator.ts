import type { TObject, TSchema } from '@sinclair/typebox'
import { ts } from '@ts-morph/bootstrap'
import { jumpgen } from 'jumpgen'
import path from 'path'
import { isString } from 'radashi'
import { extractRoutes } from './extract-routes.js'
import { TypeScriptToTypeBox } from './typebox-codegen/typescript/generator.js'

type Options = {
  /**
   * The API version.
   */
  apiVersion: string
  /**
   * The file that contains the routes.
   */
  routesFile: string
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
  jumpgen('alien-rpc', async ({ read, write, dedent }) => {
    const routes = await extractRoutes(
      read(options.routesFile, 'utf8'),
      options.routesFile
    )

    const serverDefinitions: string[] = []
    const clientDefinitions: string[] = []
    const clientInterface: string[] = []
    const clientImports = new Set<string>(['RequestParams', 'RequestOptions'])

    for (const route of routes) {
      const requestSchemaDecl = generateRuntimeValidator(
        `type Request = ${route.resolvedArguments[1]}`
      )
      const responseSchemaDecl = generateRuntimeValidator(
        `type Response = ${route.resolvedResponse}`
      )

      let jsonEncodedParams: string[] | undefined

      if (route.httpMethod === 'get') {
        const { Type, KindGuard } = await import('@sinclair/typebox')

        /**
         * Find a schema that matches the predicate. Recurse into any
         * encountered union schemas.
         */
        const findTypeInSchema = (
          schema: TSchema,
          match: (schema: TSchema) => boolean
        ): TSchema | undefined =>
          KindGuard.IsUnion(schema)
            ? schema.anyOf.find(variant => findTypeInSchema(variant, match))
            : match(schema)
              ? schema
              : undefined

        const isStringType = (schema: TSchema): boolean =>
          isString(schema.type) && schema.type === 'string'

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
          if (findTypeInSchema(propertySchema, isStringType)) {
            jsonEncodedParams.push(key)
          }
        }
      }

      serverDefinitions.push(
        `{...routes.${route.exportedName}, format: "${route.responseFormat}", requestSchema: ${requestSchemaDecl}, responseSchema: ${responseSchemaDecl}}`
      )

      const resolvedPathParams = route.resolvedArguments[0]
      const resolvedExtraParams = route.resolvedArguments[1]

      const expectsParams =
        resolvedPathParams !== '{}' || resolvedExtraParams !== '{}'

      const optionalParams =
        !expectsParams ||
        (arePropertiesOptional(resolvedPathParams) &&
          arePropertiesOptional(resolvedExtraParams))

      clientDefinitions.push(
        `${route.exportedName}: {method: "${route.httpMethod}", path: ${route.resolvedPathLiteral}, format: "${route.responseFormat}", arity: ${expectsParams ? 2 : 1}${jsonEncodedParams ? `, jsonParams: ${JSON.stringify(jsonEncodedParams)}` : ''}}`
      )

      const clientArgs: string[] = ['requestOptions?: RequestOptions']
      if (expectsParams) {
        clientArgs.unshift(
          `params${optionalParams ? '?' : ''}: RequestParams<${resolvedPathParams}, ${resolvedExtraParams}>${optionalParams ? ' | null' : ''}`
        )
      }

      let clientReturn: string
      if (route.responseFormat === 'ndjson') {
        clientImports.add('ResponseStream')
        clientReturn = route.resolvedResponse.replace(/^\w+/, 'ResponseStream')
      } else if (route.responseFormat === 'json') {
        clientReturn = `Promise<${route.resolvedResponse}>`
      } else if (route.responseFormat === 'response') {
        clientImports.add('ResponsePromise')
        clientReturn = 'ResponsePromise'
      } else {
        throw new Error(`Unsupported response format: ${route.responseFormat}`)
      }

      clientInterface.push(
        dedent`
          ${route.exportedName}: typeof API['${route.exportedName}'] & {
            callee: (${clientArgs.join(', ')}) => ${clientReturn}
          }
        `
      )
    }

    writeServerDefinitions(options.serverOutFile ?? 'server/api.ts')
    writeClientDefinitions(options.clientOutFile ?? 'client/api.ts')

    function writeServerDefinitions(outFile: string) {
      outFile = path.join(options.outDir, outFile)
      write(
        outFile,
        dedent`
          import { Type } from "@sinclair/typebox"
          import * as routes from "${resolveImportPath(outFile, options.routesFile.replace(/\.ts$/, '.js'))}"

          export default [${serverDefinitions.join(', ')}] as const
        `
      )
    }

    function writeClientDefinitions(outFile: string) {
      outFile = path.join(options.outDir, outFile)
      write(
        outFile,
        dedent`
          import { ${[...clientImports].sort().join(', ')} } from '@alien-rpc/client'

          const API = {${clientDefinitions.join(', ')}} as const

          export default API as {
            ${clientInterface.join('\n')}
          }
        `
      )
    }
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
