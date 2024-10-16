import { RequestContext } from '@hattip/compose'
import { TypeBoxError } from '@sinclair/typebox'
import { ValueError } from '@sinclair/typebox/errors'
import { compileRoute } from './compileRoute.js'
import { Route } from './types'

export function compileRoutes(routes: Route[]) {
  const compiledRoutes = routes.map(compileRoute)

  return async (ctx: RequestContext) => {
    const { url, request } = ctx
    const isOptionsRequest = request.method === 'options'

    type RequestStep = 'match' | 'decode' | 'respond'

    let step: RequestStep = 'match'

    try {
      let corsMethods: string[] | undefined

      for (const route of compiledRoutes) {
        if (!isOptionsRequest && request.method !== route.method) {
          continue
        }

        const match = route.match(url.pathname)
        if (!match) {
          continue
        }

        if (isOptionsRequest) {
          corsMethods ??= []
          corsMethods.push(route.method)
          continue
        }

        ctx.response = {
          status: 200,
          headers: new Headers({
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
          }),
        }

        step = 'decode'

        const data = await route.decodeRequestData(ctx)

        step = 'respond'

        return await route.responder(match.params, data, ctx)
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
      console.error(error)

      if (step === 'respond') {
        if (process.env.NODE_ENV === 'production') {
          return new Response(null, { status: 500 })
        }
        return new ErrorResponse(500, { message: error.message })
      }

      // Check for a ValueError from TypeBox.
      if (step === 'decode' && isValueError(error)) {
        const { message, path, value } = firstLeafError(error)
        return new ErrorResponse(400, { message, path, value })
      }

      // Otherwise, it's a malformed request.
      return new ErrorResponse(400, { message: error.message })
    }
  }
}

class ErrorResponse extends Response {
  constructor(
    status: number,
    error: { message: string } & Record<string, unknown>
  ) {
    super(JSON.stringify(error), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
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
