import { RequestContext } from '@hattip/compose'
import { TypeBoxError } from '@sinclair/typebox'
import { ValueError } from '@sinclair/typebox/errors'
import { Value } from '@sinclair/typebox/value'
import { match } from 'path-to-regexp'
import { routeRespondersByFormat } from './formats'
import { transformRequestSchema } from './requestSchema'
import { Route, RouteContext } from './types'

export function compileRoutes(routes: Route[]) {
  const compiledRoutes = routes.map(route => ({
    ...route,
    match: match(route.def.path),
    requestSchema: transformRequestSchema(route),
    handler: routeRespondersByFormat[route.format](
      route.def.handler.bind(route.def),
      route
    ),
  }))

  return async (context: RequestContext) => {
    const { request } = context
    const isOptionsRequest = request.method === 'options'

    type RequestStep = 'match' | 'decode' | 'handle'

    let step: RequestStep = 'match'

    try {
      const url = new URL(request.url)

      let corsMethods: string[] | undefined

      for (const route of compiledRoutes) {
        if (!isOptionsRequest && request.method !== route.def.method) {
          continue
        }

        const match = route.match(url.pathname)
        if (!match) {
          continue
        }

        if (isOptionsRequest) {
          corsMethods ??= []
          corsMethods.push(route.def.method)
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

        step = 'decode'

        var data: any = Value.Decode(
          route.requestSchema,
          route.def.method === 'get'
            ? Object.fromEntries(url.searchParams)
            : await request.json()
        )

        step = 'handle'

        return await route.handler(match.params, data, ctx)
      }

      if (isOptionsRequest && corsMethods) {
        const allowOrigin = request.headers.get('Origin')
        const allowMethod = request.headers.get('Access-Control-Request-Method')
        const allowHeaders = request.headers.get(
          'Access-Control-Request-Headers'
        )

        return new Response(null, {
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
    } catch (error: any) {
      if (step === 'handle') {
        console.error(error)
        return new Response(
          process.env.NODE_ENV === 'production' ? null : error.message,
          {
            status: 500,
          }
        )
      }

      // Check for a ValueError from TypeBox.
      if (step === 'decode' && isValueError(error)) {
        const { message, path, value } = firstLeafError(error)
        return new Response(
          JSON.stringify({
            error: { message, path, value },
          })
        )
      }

      // Otherwise, it's a malformed request.
      return new Response(error.message, {
        status: 400,
      })
    }
  }
}

function isValueError(error: any): error is ValueError {
  return error instanceof TypeBoxError && 'errors' in error
}

function firstLeafError(error: ValueError) {
  for (const suberror of flat(error.errors)) {
    if (suberror.errors) {
      return firstLeafError(suberror)
    }
    return suberror
  }
  return error
}

function* flat<T>(iterables: Iterable<T>[]) {
  for (const iterable of iterables) {
    yield* iterable
  }
}
