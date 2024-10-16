import { RpcResultFormatter } from '../types.js'

export default {
  mapCachedResult: Promise.resolve,
  async parseResponse(promisedResponse) {
    const response = await promisedResponse

    // Empty response equals undefined
    if (response.headers.get('Content-Length') !== '0') {
      return response.json()
    }
  },
} satisfies RpcResultFormatter<Promise<JSON | undefined>>

type JSON = { [key: string]: JSON } | readonly JSON[] | JSONValue
type JSONValue = string | number | boolean | null
