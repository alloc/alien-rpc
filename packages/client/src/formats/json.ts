import { RpcResultFormatter } from '../types.js'

type JSON = { [key: string]: JSON } | readonly JSON[] | JSONValue
type JSONValue = string | number | boolean | null

export default {
  mapCachedResult: Promise.resolve,
  async parseResponse(promisedResponse) {
    const response = await promisedResponse

    // Empty response equals undefined
    if (response.headers.get('Content-Length') !== '0') {
      return response.json() as Promise<JSON>
    }
  },
} satisfies RpcResultFormatter<Promise<JSON | undefined>>