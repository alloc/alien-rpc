import { RouteResponder, RouteResultFormat } from '../types'

import jsonResponder from './json'
import jsonSeqResponder from './json-seq'

export const supportedResponders: Record<RouteResultFormat, RouteResponder> = {
  json: jsonResponder,
  'json-seq': jsonSeqResponder,
  response: route => async (params, data, ctx) => {
    const routeDef = await route.import()
    return routeDef.handler(params, data, ctx)
  },
}
