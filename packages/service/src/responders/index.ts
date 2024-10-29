import type { RouteResultFormat } from '@alien-rpc/route'
import type { RouteResponder } from '../types'

import jsonResponder from './json'
import jsonSeqResponder from './json-seq'

export const supportedResponders: Record<RouteResultFormat, RouteResponder> = {
  json: jsonResponder,
  'json-seq': jsonSeqResponder,
  response: route => async (params, data, ctx) => {
    const routeDef = await route.import()
    const response = await routeDef.handler(params, data, ctx)
    if (ctx.request.method === 'HEAD' && route.method === 'GET') {
      return new Response(null, response)
    }
    return response
  },
}
