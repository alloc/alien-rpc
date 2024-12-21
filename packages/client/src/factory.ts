import { Simplify } from 'radashi'
import { Client, defineClient } from './client.js'
import { ClientOptions, ErrorMode, Route } from './types.js'

export function defineClientFactory<
  API extends Record<string, Route>,
  TDefaultErrorMode extends ErrorMode = ErrorMode,
>(routes: API, defaults: ClientOptions<TDefaultErrorMode> = {}) {
  function factory(): Client<API, TDefaultErrorMode>

  function factory<TErrorMode extends ErrorMode = TDefaultErrorMode>(
    options: ClientOptions<TErrorMode>
  ): Client<API, TErrorMode>

  function factory<TErrorMode extends ErrorMode = TDefaultErrorMode>(
    options?: ClientOptions<TErrorMode>
  ): Client<API> {
    return defineClient(routes, {
      ...defaults,
      ...options,
      headers: mergeHeaders(defaults.headers, options?.headers),
      hooks: mergeHooks(defaults.hooks, options?.hooks),
    })
  }

  return factory
}

type Overwrite<T, U> =
  T extends Record<string, never>
    ? U
    : U extends Record<string, never>
      ? T
      : Simplify<Omit<T, keyof U> & U>

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
