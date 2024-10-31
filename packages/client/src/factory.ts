import { defineClient } from './client.js'
import { ClientOptions, Route } from './types.js'

export function defineClientFactory<API extends Record<string, Route>>(
  routes: API,
  defaults: ClientOptions = {}
) {
  return (options?: ClientOptions) =>
    defineClient(routes, {
      ...defaults,
      ...options,
      headers: mergeHeaders(defaults.headers, options?.headers),
      hooks: mergeHooks(defaults.hooks, options?.hooks),
    })
}

function mergeHeaders(
  left: ClientOptions['headers'],
  right: ClientOptions['headers']
) {
  if (left && right) {
    const leftHeaders = new Headers(left as HeadersInit)
    const rightHeaders = new Headers(right as HeadersInit)
    rightHeaders.forEach((value, key) => leftHeaders.set(key, value))
    return leftHeaders
  }
  return left || right
}

function mergeHooks(
  left: ClientOptions['hooks'],
  right: ClientOptions['hooks']
): ClientOptions['hooks'] {
  return {
    beforeRequest: mergeOptionalArray(
      left?.beforeRequest,
      right?.beforeRequest
    ),
    afterResponse: mergeOptionalArray(
      left?.afterResponse,
      right?.afterResponse
    ),
    beforeError: mergeOptionalArray(left?.beforeError, right?.beforeError),
    beforeRetry: mergeOptionalArray(left?.beforeRetry, right?.beforeRetry),
  }
}

function mergeOptionalArray<T>(left: T[] | undefined, right: T[] | undefined) {
  return [...(left || []), ...(right || [])]
}
