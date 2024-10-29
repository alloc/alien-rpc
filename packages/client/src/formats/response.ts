import { ResultFormatter } from '../types.js'

export default {
  mapCachedResult: Promise.resolve,
  parseResponse: r => r,
} satisfies ResultFormatter<Promise<Response>>
