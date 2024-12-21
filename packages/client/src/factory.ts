import { Client, defineClient } from './client.js'
import { ClientOptions, ErrorMode, Route } from './types.js'

export function defineClientFactory<
  API extends Record<string, Route>,
  TDefaultErrorMode extends ErrorMode = ErrorMode,
>(routes: API, options: ClientOptions<TDefaultErrorMode> = {}) {
  const client = defineClient(routes, options)

  function factory(): Client<API, TDefaultErrorMode>

  function factory<TErrorMode extends ErrorMode = TDefaultErrorMode>(
    options: ClientOptions<TErrorMode>
  ): Client<API, TErrorMode>

  function factory<TErrorMode extends ErrorMode = TDefaultErrorMode>(
    options?: ClientOptions<TErrorMode>
  ): Client<API> {
    return options ? client.extend(options) : client
  }

  return factory
}
