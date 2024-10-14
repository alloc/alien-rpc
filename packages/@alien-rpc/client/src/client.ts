/// <reference lib="dom.asynciterable" />
import { juri } from '@alien-rpc/juri'
import ky, { HTTPError } from 'ky'
import { compile, parse, Token } from 'path-to-regexp'
import { isArray, isString } from 'radashi'
import {
  RequestOptions,
  ResponseCache,
  ResponseStream,
  RpcPagination,
  RpcPathname,
  RpcResponseByPath,
  RpcRoute,
} from './types.js'

interface ClientPrototype<API extends Record<string, RpcRoute>> {
  extend: (defaults: RequestOptions) => Client<API>
  setResponse: <P extends RpcPathname<API>>(
    path: P,
    response: Awaited<RpcResponseByPath<API, P>>
  ) => void
}

export type Client<API extends Record<string, RpcRoute>> =
  ClientPrototype<API> & {
    [TKey in keyof API]: Extract<API[TKey], RpcRoute>['callee']
  }

export interface ClientOptions extends RequestOptions {
  prefixUrl: string
  /**
   * This cache is checked before sending a `GET` request. It remains empty
   * until you manually call the `Client#setResponse` method.
   *
   * The `ResponseCache` interface is intentionally simplistic to allow use
   * of your own caching algorithm, like one with “least recently used”
   * eviction. Note that `undefined` values are not allowed.
   *
   * @default new Map()
   */
  responseCache?: ResponseCache
}

export function defineClient<API extends Record<string, RpcRoute>>(
  routes: API,
  options: ClientOptions
): Client<API> {
  const { prefixUrl, responseCache = new Map(), ...defaults } = options
  const { hooks } = defaults

  return createClientProxy(
    routes,
    prefixUrl,
    responseCache,
    ky.create({
      ...defaults,
      hooks: {
        ...hooks,
        beforeError: [extendHTTPError, ...(hooks?.beforeError ?? [])],
      },
    })
  )
}

async function extendHTTPError(error: HTTPError) {
  const { response } = error
  if (response.headers.get('Content-Type') === 'application/json') {
    Object.assign(error, await response.json())
  }
  return error
}

function createClientProxy<API extends Record<string, RpcRoute>>(
  routes: API,
  prefixUrl: string,
  responseCache: ResponseCache,
  request: typeof ky
): Client<API> {
  const client: ClientPrototype<API> = {
    extend: defaults =>
      createClientProxy(
        routes,
        prefixUrl,
        responseCache,
        request.extend(defaults)
      ),
    setResponse(path, response) {
      responseCache.set(path, response)
    },
  }

  return new Proxy(client, {
    get(client, key) {
      if (Object.prototype.hasOwnProperty.call(routes, key)) {
        return createRouteFunction(
          routes[key as keyof API],
          prefixUrl,
          responseCache,
          request
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
  prefixUrl: string,
  responseCache: ResponseCache,
  request: typeof ky
) {
  const parsedPath = parse(route.path)
  const pathParams = parsedPath.tokens.flatMap(stringifyToken)
  const buildPath = parsedPath.tokens.length > 1 && compile(parsedPath)

  const send = (
    method: string,
    url: string,
    options: import('ky').Options | undefined,
    body?: { json: any } | false
  ) => {
    const promisedResponse = request(url, {
      ...options,
      ...body,
      method,
    })

    if (route.format === 'response') {
      return promisedResponse
    }

    if (route.format === 'json') {
      return resolveJsonResponse(promisedResponse)
    }

    if (route.format === 'json-seq') {
      // Keep a reference to the iterator, so we can attach previousPage
      //and nextPage methods when a pagination result is provided.
      let responseStream!: ResponseStream<any>

      return (responseStream = (async function* () {
        const response = await promisedResponse
        if (!response.body) {
          return
        }

        const { ObjectParser } = await import('@aleclarson/json-stream')

        for await (const object of response.body.pipeThrough(
          new ObjectParser()
        )) {
          if (isPagination(object)) {
            if (object.$prev) {
              responseStream.previousPage = () =>
                send('get', prefixUrl + object.$prev, options) as any
            }
            if (object.$next) {
              responseStream.nextPage = () =>
                send('get', prefixUrl + object.$next, options) as any
            }
          } else {
            yield object
          }
        }
      })())
    }

    throw new Error('Unsupported route format: ' + route.format)
  }

  return (
    arg: unknown,
    options = route.arity === 1
      ? (arg as import('ky').Options | undefined)
      : undefined
  ) => {
    let params: Record<string, any> | undefined
    if (route.arity === 2 && arg != null) {
      params = isObject(arg) ? arg : { [pathParams[0]]: arg }
    }

    const path = buildPath ? buildPath(params!) : route.path

    if (route.method === 'get') {
      let cacheKey = path

      const searchParams = encodeJsonSearch(
        params as Record<string, any>,
        pathParams,
        route.jsonParams!
      )
      if (searchParams) {
        options ||= {}
        options.searchParams = searchParams

        // The search params are sorted to ensure consistent cache keys.
        cacheKey += '?' + searchParams.toString()
      }

      const response = responseCache.get(cacheKey)
      if (response !== undefined) {
        return Promise.resolve(response)
      }
    }

    return send(
      route.method,
      prefixUrl + path,
      options,
      route.method !== 'get' && {
        json: params,
      }
    )
  }
}

function isPagination(arg: object): arg is RpcPagination {
  // The server ensures both `prev` and `next` are defined, even though the
  // RpcPagination type says otherwise.
  return (
    Object.prototype.hasOwnProperty.call(arg, '$prev') &&
    Object.prototype.hasOwnProperty.call(arg, '$next') &&
    checkKeyCount(arg, 2)
  )
}

function checkKeyCount(object: object, count: number) {
  let i = 0
  for (const _ in object) {
    if (++i > count) {
      break
    }
  }
  return i === count
}

function encodeJsonSearch(
  params: Record<string, any> | undefined,
  pathParams: string[],
  jsonParams: string[]
) {
  if (!params) {
    return
  }
  let searchParams: URLSearchParams | undefined
  for (const key of Object.keys(params).sort()) {
    if (pathParams.includes(key)) {
      continue
    }
    const value = params[key]
    if (value == null) {
      continue
    }
    searchParams ||= new URLSearchParams()
    searchParams.append(
      key,
      !isString(value) || jsonParams.includes(key)
        ? isArray(value) || isObject(value)
          ? juri.encode(value)
          : JSON.stringify(value)
        : value
    )
  }
  return searchParams
}

function isObject(arg: unknown) {
  return Object.getPrototypeOf(arg) === Object.prototype
}

async function resolveJsonResponse(promise: Promise<Response>) {
  const response = await promise
  // Empty response equals undefined
  if (response.headers.get('Content-Length') !== '0') {
    return response.json()
  }
}

function stringifyToken(token: Token): string | string[] {
  switch (token.type) {
    case 'param':
    case 'wildcard':
      return token.name
    case 'group':
      return token.tokens.flatMap(stringifyToken)
    case 'text':
      return []
  }
}
