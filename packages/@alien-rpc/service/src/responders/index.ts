import type { RpcResultFormat } from '@alien-rpc/client'
import { RouteResponder } from '../types'

import jsonResponder from './json'
import jsonSeqResponder from './json-seq'

export const supportedResponders: Record<
  RpcResultFormat,
  RouteResponder<any>
> = {
  json: jsonResponder,
  'json-seq': jsonSeqResponder,
  response: handler => handler,
}
