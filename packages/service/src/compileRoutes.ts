import { RequestContext } from '@hattip/compose'
import { ValueError } from '@sinclair/typebox/errors'
import {
  TransformDecodeCheckError,
  TransformDecodeError,
} from '@sinclair/typebox/value'
import { compileRoute } from './compileRoute.js'
import { Route } from './types'

export function compileRoutes(
  routes: readonly Route[],
  options: { returnNotFound?: boolean } = {}
) {
  const compiledRoutes = routes.map(compileRoute)

  return async (ctx: RequestContext): Promise<Response | undefined> => {
    const { url, request } = ctx
    const isOptionsRequest = request.method === 'OPTIONS'

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

      if (options.returnNotFound) {
        return new Response(null, { status: 404 })
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
      if (step === 'decode') {
        if (isDecodeError(error)) {
          error = error.error
        }
        if (isDecodeCheckError(error)) {
          const { message, path, value } = firstLeafError(error.error)
          return new ErrorResponse(400, { message, path, value })
        }
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

function isDecodeError(error: any): error is TransformDecodeError {
  return error instanceof TransformDecodeError
}

function isDecodeCheckError(error: any): error is TransformDecodeCheckError {
  return error instanceof TransformDecodeCheckError
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
