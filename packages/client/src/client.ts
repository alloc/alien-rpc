/// <reference lib="dom.asynciterable" />
import * as jsonQS from '@json-qs/json-qs'
import ky, { HTTPError } from 'ky'
import { buildPath } from 'pathic'
import { isString } from 'radashi'
import jsonFormat from './formats/json.js'
import responseFormat from './formats/response.js'
import {
  ClientOptions,
  RpcCachedResult,
  RpcPathname,
  RpcResponseByPath,
  RpcResultCache,
  RpcResultFormatter,
  RpcRoute,
} from './types.js'

interface ClientPrototype<API extends Record<string, RpcRoute>> {
  extend: (defaults: ClientOptions) => Client<API>
  request: typeof ky
  getCachedResponse: <P extends RpcPathname<API>>(
    path: P
  ) => RpcCachedResult<Awaited<RpcResponseByPath<API, P>>> | undefined
  setCachedResponse: <P extends RpcPathname<API>>(
    path: P,
    response: RpcCachedResult<Awaited<RpcResponseByPath<API, P>>>
  ) => void
}

export type Client<
  API extends Record<string, RpcRoute> = Record<string, RpcRoute>,
> = ClientPrototype<API> & {
  [TKey in keyof API]: Extract<API[TKey], RpcRoute>['callee']
}

export function defineClient<API extends Record<string, RpcRoute>>(
  routes: API,
  options: ClientOptions = {}
): Client<API> {
  const { resultCache = new Map(), ...defaults } = options
  const { hooks } = defaults

  return createClientProxy(
    routes,
    resultCache,
    ky.create({
      ...defaults,
      prefixUrl: defaults.prefixUrl ?? '/',
      hooks: {
        ...hooks,
        beforeError: mergeHooks(hooks?.beforeError, extendHTTPError, 'start'),
      },
    })
  )
}

async function extendHTTPError(error: HTTPError) {
  const { request, response } = error
  if (response.headers.get('Content-Type') === 'application/json') {
    const errorInfo = await response.json()
    Object.assign(error, errorInfo)
    if ('path' in errorInfo) {
      error.message += `\n     Path: ${errorInfo.path}\n    Value: ${errorInfo.value}\n  Request: ${request.method} ${request.url}`
    }
  }
  return error
}

function createClientProxy<API extends Record<string, RpcRoute>>(
  routes: API,
  resultCache: RpcResultCache,
  request: typeof ky
): Client<API> {
  const client: ClientPrototype<API> = {
    extend: defaults =>
      createClientProxy(
        routes,
        defaults.resultCache ?? resultCache,
        request.extend(defaults)
      ),
    request,
    getCachedResponse(path) {
      return resultCache.get(path) as any
    },
    setCachedResponse(path, response) {
      resultCache.set(path, response)
    },
  }

  return new Proxy(client, {
    get(client, key, proxy) {
      if (Object.prototype.hasOwnProperty.call(routes, key)) {
        return createRouteFunction(
          routes[key as keyof API],
          resultCache,
          request,
          proxy
        )
      }
      if (client.hasOwnProperty(key)) {
        return client[key as keyof ClientPrototype<API>]
      }
    },
  }) as any
}

function createRouteFunction(
  route: RpcRoute,
  responseCache: RpcResultCache,
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

    let path = buildPath(route.path, route.pathParams)

    if (route.method === 'get') {
      if (params) {
        const query = jsonQS.encode(params, {
          skippedKeys: route.pathParams,
        })
        if (query) {
          path += '?' + query
        }
      }
      if (responseCache.has(path)) {
        return format.mapCachedResult(responseCache.get(path), client)
      }
    }

    const promisedResponse = request(path, {
      ...options,
      json: route.method !== 'get' ? params : undefined,
      method: route.method,
    })

    return format.parseResponse(promisedResponse, client)
  }
}

function mergeHooks<T>(
  hooks: T[] | undefined,
  hook: T | undefined,
  position: 'start' | 'end'
) {
  return hook
    ? hooks
      ? position === 'start'
        ? [hook, ...hooks]
        : [...hooks, hook]
      : [hook]
    : hooks
}

function resolveResultFormat(format: RpcRoute['format']): RpcResultFormatter {
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
