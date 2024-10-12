import type { RpcResponseFormat } from '@alien-rpc/client'
import { RouteResponder } from '../types'

import jsonResponder from './json'
import jsonSeqResponder from './json-seq'

export const routeRespondersByFormat: Record<
  RpcResponseFormat,
  RouteResponder<any>
> = {
  json: jsonResponder,
  'json-seq': jsonSeqResponder,
  response: handler => handler,
}
