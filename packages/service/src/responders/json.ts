import { Value } from '@sinclair/typebox/value'
import type { JSON, Promisable } from '../internal/types'
import type { RouteResponder } from '../types'

const responder: RouteResponder =
  route =>
  async (args, { request, response }) => {
    const routeDef = await route.import()

    let result: Promisable<JSON> = await routeDef.handler.apply<any, any, any>(
      routeDef,
      args
    )

    if (request.method === 'HEAD') {
      result = null
    } else {
      result = Value.Encode(route.responseSchema, result)

      if (result === undefined) {
        response.headers.set('Content-Length', '0')
      } else {
        response.headers.set('Content-Type', 'application/json')
        result = JSON.stringify(result)
      }
    }

    return new Response(result, response)
  }

export default responder
