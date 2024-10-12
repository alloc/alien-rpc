import { Value } from '@sinclair/typebox/value'
import { JSON, Promisable } from '../internal/types'
import { RouteResponder } from '../types'

const responder: RouteResponder<Promisable<JSON>> =
  (handler, route) => async (params, data, ctx) => {
    let result = await handler(params, data, ctx)
    result = Value.Encode(route.responseSchema, result)

    if (result === undefined) {
      ctx.response.headers.set('Content-Length', '0')
    } else {
      ctx.response.headers.set('Content-Type', 'application/json')
      result = JSON.stringify(result)
    }

    return new Response(result, {
      status: ctx.response.status,
      headers: ctx.response.headers,
    })
  }

export default responder
