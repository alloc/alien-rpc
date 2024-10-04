import { RequestContext } from '@hattip/compose'
import { TypeBoxError } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { RpcContext, RpcFunction } from './function'
import { compileEndpoints, encodeAsyncIterable, toArray } from './util'

export interface ServiceHandlerOptions {}

export interface Service<API extends object> {
  /**
   * If you want to split out RPC functions into logical groups, this function is useful for type
   * inference.
   */
  defineFunctions: <T extends { [P in keyof API]?: RpcFunction<API[P]> }>(
    functions: T
  ) => T
  /**
   * Returns a `@hattip/compose` handler.
   */
  defineHandler: <P = unknown>(
    functions: { [P in keyof API]: RpcFunction<API[P]> },
    options?: ServiceHandlerOptions
  ) => (context: RequestContext<P>) => Promise<Response | undefined>
}

/**
 * Create the RPC function context.
 */
export function createService<API extends object>(API: API): Service<API> {
  return {
    defineFunctions(functions) {
      return functions
    },
    defineHandler(functions, options) {
      const endpoints = compileEndpoints(API)

      return async context => {
        const { request } = context
        const isOptions = request.method === 'OPTIONS'
        const url = new URL(request.url)

        let corsMethods: string[] | undefined

        for (const endpoint of endpoints) {
          if (!isOptions && request.method !== endpoint.method) {
            continue
          }
          const match = endpoint.match(url.pathname)
          if (match) {
            if (isOptions) {
              corsMethods ??= []
              corsMethods.push(endpoint.method)
              continue
            }

            const fn: (this: RpcContext, ...args: any[]) => any =
              functions[endpoint.name as keyof API]

            if (!fn) {
              console.error(`Function "${endpoint.name}" is not defined`)
              return new Response(null, { status: 501 })
            }

            let args =
              endpoint.schema.parameters.length > 0
                ? endpoint.method === 'GET'
                  ? [Object.fromEntries(url.searchParams)]
                  : toArray(await context.request.json())
                : null!

            try {
              args = endpoint.schema.parameters.map((schema, i) => {
                // Treat undefined as null during runtime validation.
                const arg = Value.Decode(schema, args[i] ?? null)
                // Coerce null to undefined, so ES6 default parameter syntax works.
                return arg !== null ? arg : undefined
              })
            } catch (error) {
              if (error instanceof TypeBoxError) {
                const e: any = error
                e.error ??= { message: 'Unsupported value' }
                return new Response(JSON.stringify(e), { status: 200 })
              }
              console.error(error)
              return new Response(null, { status: 500 })
            }

            if (Object.keys(match.params).length) {
              args = [match.params, ...args]
            }

            const ctx = context as RpcContext
            ctx.url = url
            ctx.response = {
              status: 200,
              headers: new Headers({
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Origin':
                  request.headers.get('Origin') ?? '*',
              }),
            }

            try {
              let result = await fn.apply(ctx, args)
              if (endpoint.type === 'json') {
                if (endpoint.optionalReturn && result === undefined) {
                  ctx.response.headers.set('Content-Length', '0')
                } else {
                  ctx.response.headers.set('Content-Type', 'application/json')
                  result = Value.Encode(endpoint.schema.returns, result)
                  result = JSON.stringify(result)
                }
              } else if (endpoint.type === 'ndjson') {
                ctx.response.headers.set(
                  'Content-Type',
                  'text/plain; charset=utf-8'
                )
                result = encodeAsyncIterable(result, endpoint, ctx)
              } else if (endpoint.type === 'text') {
                ctx.response.headers.set(
                  'Content-Type',
                  'text/plain; charset=utf-8'
                )
              }
              return new Response(result, {
                status: ctx.response.status,
                headers: ctx.response.headers,
              })
            } catch (error) {
              console.error(error)
              return new Response(null, { status: 500 })
            }
          }
        }

        if (isOptions && corsMethods) {
          const allowOrigin = request.headers.get('Origin')
          const allowMethod = request.headers.get(
            'Access-Control-Request-Method'
          )
          const allowHeaders = request.headers.get(
            'Access-Control-Request-Headers'
          )

          return new Response(null, {
            status: 200,
            headers: {
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Headers': allowHeaders || '',
              'Access-Control-Allow-Methods':
                allowMethod && corsMethods.includes(allowMethod)
                  ? allowMethod
                  : corsMethods.join(', '),
              'Access-Control-Allow-Origin': allowOrigin || '',
            },
          })
        }
      }
    },
  }
}
