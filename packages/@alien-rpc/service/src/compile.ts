import { RequestContext } from '@hattip/compose'
import { Errors, ValueError } from '@sinclair/typebox/errors'
import { Value } from '@sinclair/typebox/value'
import { match } from 'path-to-regexp'
import { isPromise } from 'util/types'
import { ndjson } from './ndjson'
import { transformRequestSchema } from './requestSchema'
import {
  Promisable,
  RouteContext,
  RouteDefinition,
  ValidIterator,
} from './types'

function compileRouteHandler(
  route: RouteDefinition
): (
  params: Record<string, unknown>,
  data: Record<string, unknown>,
  ctx: RouteContext
) => Promise<Response> {
  if (route.format === 'response') {
    return route.handler
  }
  const { handler } = route
  if (route.format === 'ndjson') {
    return async (params, data, ctx) => {
      let result = handler(params, data, ctx) as Promisable<ValidIterator>
      if (isPromise(result)) {
        result = await result
      }
      ctx.response.headers.set('Content-Type', 'text/plain; charset=utf-8')
      const stream = ReadableStream.from(ndjson(result, route, ctx))
      return new Response(stream, {
        status: ctx.response.status,
        headers: ctx.response.headers,
      })
    }
  }
  return async (params, data, ctx) => {
    let result = await handler(params, data, ctx)
    if (result === undefined) {
      ctx.response.headers.set('Content-Length', '0')
    } else {
      ctx.response.headers.set('Content-Type', 'application/json')
      result = Value.Encode(route.responseSchema, result)
      result = JSON.stringify(result)
    }
    return new Response(result, {
      status: ctx.response.status,
      headers: ctx.response.headers,
    })
  }
}

export function compileRoutes(routes: RouteDefinition[]) {
  const compiledRoutes = routes.map(route => ({
    ...route,
    match: match(route.path),
    requestSchema: transformRequestSchema(route),
    handler: compileRouteHandler(route),
  }))

  return async (context: RequestContext) => {
    const { request } = context
    const isOptions = request.method === 'options'
    const url = new URL(request.url)

    let corsMethods: string[] | undefined

    for (const route of compiledRoutes) {
      if (!isOptions && request.method !== route.method) {
        continue
      }
      const match = route.match(url.pathname)
      if (match) {
        if (isOptions) {
          corsMethods ??= []
          corsMethods.push(route.method)
          continue
        }

        const ctx = context as RouteContext
        ctx.url = url
        ctx.response = {
          status: 200,
          headers: new Headers({
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
          }),
        }

        const data: any =
          route.method === 'get'
            ? Object.fromEntries(url.searchParams)
            : await request.json()

        const dataError = Errors(route.requestSchema, data).First()
        if (dataError) {
          const body = JSON.stringify({ error: firstLeafError(dataError) })
          return new Response(body, {
            status: 200,
          })
        }

        try {
          return await (0, route.handler)(match.params, data, ctx)
        } catch (error) {
          console.error(error)
          return new Response(null, { status: 500 })
        }
      }
    }

    if (isOptions && corsMethods) {
      const allowOrigin = request.headers.get('Origin')
      const allowMethod = request.headers.get('Access-Control-Request-Method')
      const allowHeaders = request.headers.get('Access-Control-Request-Headers')

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
}

/**
 * Finds the first leaf error in a ValueError.
 */
function firstLeafError(error: ValueError) {
  for (const suberror of error.errors) {
    if (suberror.errors) {
      return FirstLeafError(suberror)
    }
    return suberror
  }
  yield error
}
