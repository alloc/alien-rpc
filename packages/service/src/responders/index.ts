import type { RpcResultFormat } from '@alien-rpc/client'
import { RouteResponder } from '../types'

import jsonResponder from './json'
import jsonSeqResponder from './json-seq'

export const supportedResponders: Record<RpcResultFormat, RouteResponder> = {
  json: jsonResponder,
  'json-seq': jsonSeqResponder,
  response: route => async (params, data, ctx) => {
    const routeDef = await route.import()
    return routeDef.handler(params, data, ctx)
  },
}
