/// <reference lib="dom.asynciterable" />
import { bodylessMethods } from '@alien-rpc/route'
import * as jsonQS from '@json-qs/json-qs'
import ky, { HTTPError } from 'ky'
import { buildPath } from 'pathic'
import { isFunction, isPromise, isString } from 'radashi'
import jsonFormat from './formats/json.js'
import responseFormat from './formats/response.js'
import {
  CachedRouteResult,
  ClientOptions,
  ErrorMode,
  ResponseStream,
  ResultFormatter,
  Route,
  RoutePathname,
  RouteResponseByPath,
  RouteResultCache,
} from './types.js'

interface ClientPrototype<API extends Record<string, Route>> {
  readonly request: typeof ky
  readonly options: Readonly<ClientOptions>
  extend(defaults: ClientOptions): Client<API>
  getCachedResponse<P extends RoutePathname<API>>(
    path: P
  ): CachedRouteResult<Awaited<RouteResponseByPath<API, P>>> | undefined
  setCachedResponse<P extends RoutePathname<API>>(
    path: P,
    response: CachedRouteResult<Awaited<RouteResponseByPath<API, P>>>
  ): void
  unsetCachedResponse<P extends RoutePathname<API>>(path: P): void
}

export type Client<
  API extends Record<string, Route> = Record<string, Route>,
  TErrorMode extends ErrorMode = ErrorMode,
> = ClientPrototype<API> & {
  [TKey in keyof API]: Extract<API[TKey], Route>['callee'] extends (
    ...args: infer TArgs
  ) => infer TResult
    ? (
        ...args: TArgs
      ) => TResult extends ResponseStream<any>
        ? TResult
        : TErrorMode extends 'return'
          ? Promise<[Error, undefined] | [undefined, Awaited<TResult>]>
          : TResult
    : never
}

export function defineClient<
  API extends Record<string, Route>,
  TErrorMode extends ErrorMode = ErrorMode,
>(
  routes: API,
  options: ClientOptions<TErrorMode> = {},
  parent?: Client<any> | undefined
): Client<API, TErrorMode> {
  const {
    errorMode = parent?.options.errorMode ?? 'reject',
    resultCache = parent?.options.resultCache ?? new Map(),
  } = options

  let request: typeof ky | undefined

  const client: Client<API, TErrorMode> = createClientProxy(routes, {
    options: {
      ...options,
      errorMode,
      resultCache,
    },
    get request() {
      return (request ??= createRequest(client))
    },
    extend(options) {
      return defineClient(routes, options, client)
    },
    getCachedResponse(path) {
      return resultCache.get(path) as any
    },
    setCachedResponse(path, response) {
      resultCache.set(path, response)
    },
    unsetCachedResponse(path) {
      resultCache.delete(path)
    },
  })

  return client
}

async function extendHTTPError(error: HTTPError) {
  const { response } = error
  if (response.headers.get('Content-Type') === 'application/json') {
    const errorInfo = await response.json<any>()
    Object.assign(error, errorInfo)
  }
  return error
}

function createRequest(client: Client<any>) {
  let { hooks, prefixUrl = '/' } = client.options

  if (isFunction(hooks)) {
    hooks = hooks(client)
  }

  hooks ??= {}
  hooks.beforeError = insertHook(hooks.beforeError, extendHTTPError, prepend)

  return ky.create({
    ...client.options,
    prefixUrl,
    hooks,
  })
}

function createClientProxy<API extends Record<string, Route>>(
  routes: API,
  client: ClientPrototype<API>
): any {
  return new Proxy(client, {
    get(client, key, proxy) {
      if (Object.prototype.hasOwnProperty.call(routes, key)) {
        return createRouteFunction(
          routes[key as keyof API],
          client.options.errorMode!,
          client.options.resultCache!,
          client.request,
          proxy
        )
      }
      if (client.hasOwnProperty(key)) {
        return client[key as keyof ClientPrototype<API>]
      }
    },
  })
}

function createRouteFunction(
  route: Route,
  errorMode: ErrorMode,
  resultCache: RouteResultCache,
  request: typeof ky,
  client: Client
) {
  const format = resolveResultFormat(route.format)

  return (
    arg: unknown,
    options = route.arity === 1
      ? (arg as import('ky').Options | undefined)
      : undefined
  ) => {
    let params: Record<string, any> | undefined
    if (route.arity === 2 && arg != null) {
      if (isObject(arg)) {
        params = arg
      } else if (route.pathParams.length) {
        params = { [route.pathParams[0]]: arg }
      } else {
        throw new Error('No path parameters found for route: ' + route.path)
      }
    }

    let path = buildPath(route.path, params ?? {})
    let body: unknown

    if (bodylessMethods.has(route.method)) {
      if (params) {
        const query = jsonQS.encode(params, {
          skippedKeys: route.pathParams,
        })
        if (query) {
          path += '?' + query
        }
      }
      if (route.method === 'GET' && resultCache.has(path)) {
        return format.mapCachedResult(resultCache.get(path), client)
      }
    } else {
      body = params
    }

    const promisedResponse = request(path, {
      ...options,
      json: body,
      method: route.method,
    })

    if (errorMode === 'return') {
      const result = format.parseResponse(promisedResponse, client)
      if (isPromise(result)) {
        return result.then(
          result => [undefined, result],
          error => [error, undefined]
        )
      }
      return result
    }
    return format.parseResponse(promisedResponse, client)
  }
}

function insertHook<T>(
  hooks: T[] | undefined,
  hook: T | undefined,
  insert: (hooks: T[], hook: T) => T[]
) {
  return hook ? (hooks ? insert(hooks, hook) : [hook]) : hooks
}

function prepend<T>(array: T[], newValue: T) {
  return [newValue, ...array]
}

function resolveResultFormat(format: Route['format']): ResultFormatter {
  if (format === 'response') {
    return responseFormat
  }
  if (format === 'json') {
    return jsonFormat
  }
  if (isString(format)) {
    throw new Error('Unsupported route format: ' + format)
  }
  return format
}

function isObject(arg: unknown) {
  return Object.getPrototypeOf(arg) === Object.prototype
}
