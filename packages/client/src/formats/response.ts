import { RpcResultFormatter } from '../types.js'

export default {
  mapCachedResult: Promise.resolve,
  parseResponse: r => r,
} satisfies RpcResultFormatter<Promise<Response>>
