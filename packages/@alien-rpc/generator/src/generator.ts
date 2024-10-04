import { jumpgen } from 'jumpgen'
import { pascal } from 'radashi'
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
   * Whether to write the generated files to the output directory.
   *
   * @default true
   */
  write?: boolean
}

export default (options: Options) =>
  jumpgen('alien-rpc', async ({ read }) => {
    const routes = await extractRoutes(
      read(options.routesFile, 'utf8'),
      options.routesFile
    )
    for (const route of routes) {
      const routeTypeName = pascal(route.exportedName)
      const types = [
        `type Request = { pathParams: ${route.resolvedHandlerParams[0]}; ${route.httpMethod === 'get' ? 'searchParams' : 'body'}: ${route.resolvedHandlerParams[1]} }`,
        `type Response = ${route.resolvedHandlerReturnType}`,
      ]

      const validators = types.map(type =>
        TypeScriptToTypeBox.Generate(type, {
          useTypeBoxImport: false,
        })
      )

      console.log(validators)
    }
  })
