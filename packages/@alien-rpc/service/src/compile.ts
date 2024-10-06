import { RequestContext } from '@hattip/compose'
import { Errors, ValueError } from '@sinclair/typebox/errors'
import { match } from 'path-to-regexp'
import { RouteContext, RouteDefinition } from './types'

export function compileRoutes(routes: RouteDefinition[]) {
  const compiledRoutes = routes.map(route => ({
    ...route,
    match: match(route.path),
    requestSchema:
      route.method === 'get'
        ? transformGetParams(route.requestSchema)
        : route.requestSchema,
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
          let result = await (0, route.handler)(match.params, data, ctx)

          if (route.type === 'json') {
            if (route.optionalReturn && result === undefined) {
              ctx.response.headers.set('Content-Length', '0')
            } else {
              ctx.response.headers.set('Content-Type', 'application/json')
              result = Value.Encode(route.schema.returns, result)
              result = JSON.stringify(result)
            }
          } else if (route.type === 'ndjson') {
            ctx.response.headers.set(
              'Content-Type',
              'text/plain; charset=utf-8'
            )
            result = encodeAsyncIterable(result, route, ctx)
          } else if (route.type === 'text') {
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
