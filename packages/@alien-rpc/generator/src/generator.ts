import type { TObject, TSchema } from '@sinclair/typebox'
import { jumpgen } from 'jumpgen'
import path from 'path'
import { isString } from 'radashi'
import ts from 'typescript'
import { extractRoutes } from './extract-routes.js'
import { TypeScriptToTypeBox } from './typebox-codegen/typescript/generator.js'

type Options = {
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

    for (const route of routes) {
      const requestSchemaDecl = generateRuntimeValidator(
        `type Request = ${route.resolvedHandlerParams[1]}`
      )
      const responseSchemaDecl = generateRuntimeValidator(
        `type Response = ${route.resolvedHandlerReturnType}`
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
          'return ' + requestSchemaDecl,
          'Type'
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
        `{...routes.${route.exportedName}, requestSchema: ${requestSchemaDecl}, responseSchema: ${responseSchemaDecl}}`
      )

      const resolvedPathParams = route.resolvedHandlerParams[0]
      const resolvedExtraParams = route.resolvedHandlerParams[1]

      const expectsParams =
        resolvedPathParams !== '{}' || resolvedExtraParams !== '{}'

      const optionalParams =
        !expectsParams ||
        (arePropertiesOptional(resolvedPathParams) &&
          arePropertiesOptional(resolvedExtraParams))

      const resolvedReturn = route.resolvedHandlerReturnType
      const responseType =
        resolvedReturn === 'string'
          ? 'text'
          : resolvedReturn === 'Buffer' ||
              resolvedReturn.startsWith('ReadableStream<')
            ? 'blob'
            : resolvedReturn.startsWith('AsyncGenerator<')
              ? 'ndjson'
              : 'json'

      clientDefinitions.push(
        `${route.exportedName}: {method: "${route.httpMethod}", path: ${route.resolvedPathLiteral}, arity: ${expectsParams ? 2 : 1},${jsonEncodedParams ? ` jsonParams: ${JSON.stringify(jsonEncodedParams)},` : ''} type: "${responseType}"}`
      )

      const clientArgs: string[] = ['requestOptions?: RequestOptions']
      if (expectsParams) {
        clientArgs.unshift(
          `params${optionalParams ? '?' : ''}: RequestParams<${resolvedPathParams}, ${resolvedExtraParams}>${optionalParams ? ' | null' : ''}`
        )
      }

      const clientReturn =
        responseType === 'ndjson'
          ? `ResponseStream<${parseAsyncGeneratorYieldType(resolvedReturn)}>`
          : responseType === 'json'
            ? `Promise<${resolvedReturn}>`
            : `AsyncIterable<${responseType === 'blob' ? 'Uint8Array' : 'string'}>`

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
          import { RequestParams, RequestOptions } from '@alien-rpc/client'

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

function parseAsyncGeneratorYieldType(type: string) {
  const typeNode = parseTypeLiteral(type)
  if (ts.isTypeReferenceNode(typeNode)) {
    if (typeNode.typeArguments?.length) {
      return typeNode.typeArguments[0].getText()
    }
    throw new Error('Expected type argument')
  }
  throw new Error('Expected async generator type')
}

function parseTypeLiteral(type: string) {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    `type Temp = ${type}`,
    ts.ScriptTarget.Latest
  )
  return (sourceFile.statements[0] as ts.TypeAliasDeclaration).type
}
