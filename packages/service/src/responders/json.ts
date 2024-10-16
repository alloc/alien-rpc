import { Value } from '@sinclair/typebox/value'
import { JSON, Promisable } from '../internal/types'
import { RouteDefinition, RouteResponder } from '../types'

type TDefinition = RouteDefinition<any, any, Promisable<JSON>>

const responder: RouteResponder<TDefinition> =
  route => async (params, data, ctx) => {
    const routeDef = await route.import()

    let result = await routeDef.handler(params, data, ctx)
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
