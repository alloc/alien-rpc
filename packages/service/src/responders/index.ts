import type { RouteResultFormat } from '@alien-rpc/route'
import type { RouteResponder } from '../types'

import jsonResponder from './json'
import jsonSeqResponder from './json-seq'

export const supportedResponders: Record<RouteResultFormat, RouteResponder> = {
  json: jsonResponder,
  'json-seq': jsonSeqResponder,
  response:
    route =>
    async (args, { request }) => {
      const routeDef = await route.import()

      const response: Response = await routeDef.handler.apply<any, any, any>(
        routeDef,
        args
      )

      if (request.method === 'HEAD' && route.method === 'GET') {
        return new Response(null, response)
      }
      return response
    },
}
