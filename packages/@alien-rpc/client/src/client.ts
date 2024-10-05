import { juri } from '@alien-rpc/juri'
import ky from 'ky'
import { parse, Token as PathToken, tokensToFunction } from 'path-to-regexp'
import {
  RequestOptions,
  ResponseStream,
  RpcPagination,
  RpcPathname,
  RpcResponseByPath,
  RpcRoute,
} from './types.js'

export type Client<API extends Record<string, RpcRoute>> = {
  extend: (defaults: RequestOptions) => Client<API>
  setResponse: <P extends RpcPathname<API>>(
    path: P,
    response: Awaited<RpcResponseByPath<API, P>>
  ) => void
} & {
  [TKey in keyof API]: Extract<API[TKey], RpcRoute>['callee']
}

export function defineClient<API extends Record<string, RpcRoute>>(
  endpoints: API,
  { prefixUrl, ...options }: RequestOptions & { prefixUrl: string }
): Client<API> {
  const request = ky.create(options)
  const responses: any = {}
  class Client {
    setResponse(path: string, response: any) {
      responses[path] = response
    }
  }
  return new Proxy(request as any, {
    get(target, prop) {
      if (prop in endpoints) {
        const endpoint = endpoints[prop as string]
        const pathTokens = parse(endpoint.path)
        const firstParamName = pathTokenToName(pathTokens[0])
        const path = pathTokens.length > 1 && tokensToFunction(pathTokens)
        const type = endpoint.type

        const endpointRequest = (
          method: string,
          url: string,
          options: RequestOptions | undefined,
          body?: { json: any } | false
        ) => {
          const promise = request(url, {
            ...options,
            ...body,
            method,
          })

          if (type === 'json') {
            return (async () => {
              const response = await promise
              if (response.headers.get('Content-Length') === '0') {
                return null
              }
              return response.json()
            })()
          }

          let responseStream!: ResponseStream<any>
          return (responseStream = (async function* () {
            const response = await promise

            const body: AsyncIterable<Uint8Array> & {
              pipeThrough: <T>(
                transform: TransformStream<any, T>
              ) => AsyncIterable<T>
            } = response.body as any

            if (type === 'ndjson') {
              const { ObjectParser } = await import('@aleclarson/json-stream')
              for await (const object of body.pipeThrough(new ObjectParser())) {
                if (isPagination(object)) {
                  const { prev, next } = object
                  if (prev) {
                    responseStream.previousPage = () =>
                      endpointRequest('GET', prefixUrl + prev, options) as any
                  }
                  if (next) {
                    responseStream.nextPage = () =>
                      endpointRequest('GET', prefixUrl + next, options) as any
                  }
                } else {
                  yield object
                }
              }
            } else if (type === 'text') {
              yield* body.pipeThrough(new TextDecoderStream())
            } else {
              yield* body
            }
          })())
        }

        return (params: unknown, options?: RequestOptions) => {
          // Pathname
          const pathname = params ? path(params) : endpoint.path

          if (endpoint.method === 'get') {
            const searchParams = encodeJsonSearch(params as Record<string, any>)
            if (searchParams) {
              options ||= {}
              options.searchParams = searchParams
            }

            let cacheKey = pathname
            if (searchParams?.size) {
              cacheKey += '?' + sortSearchParams(searchParams).toString()
            }

            if (cacheKey in responses) {
              return Promise.resolve(responses[cacheKey])
            }
          }

          return endpointRequest(
            endpoint.method,
            prefixUrl + pathname,
            options,
            endpoint.method !== 'get' && {
              json: params,
            }
          )
        }
      }
      if (Client.prototype.hasOwnProperty(prop)) {
        return Client.prototype[prop as keyof Client]
      }
      if (prop in target) {
        return target[prop]
      }
    },
  })
}

function isPagination(arg: object): arg is RpcPagination {
  // The server ensures both `prev` and `next` are defined, even though the
  // RpcPagination type says otherwise.
  return (
    Object.prototype.hasOwnProperty.call(arg, 'prev') &&
    Object.prototype.hasOwnProperty.call(arg, 'next') &&
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

function encodeJsonSearch(params: Record<string, any> | undefined) {
  if (!params) {
    return
  }
  let searchParams: URLSearchParams | undefined
  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue
    }
    searchParams ||= new URLSearchParams()
    searchParams.append(
      key,
      typeof value !== 'string'
        ? typeof value === 'object'
          ? juri.encode(value)
          : JSON.stringify(value)
        : value
    )
  }
  return searchParams
}

function getRequiredParams(params: readonly any[]) {
  for (let i = params.length - 1; i >= 0; i--) {
    const param = params[i]
    if (!isOptional(param)) {
      return params.slice(0, i + 1)
    }
  }
  return []
}

function isOptional(param: any) {
  if (param.anyOf) {
    return param.anyOf.some(isOptional)
  }
  return param.type === 'null'
}

declare global {
  interface URLSearchParams {
    keys(): IterableIterator<string>
  }
}

function sortSearchParams(searchParams: URLSearchParams) {
  const sorted = new URLSearchParams()
  for (const key of [...searchParams.keys()].sort()) {
    sorted.append(key, searchParams.get(key)!)
  }
  return sorted
}

function pathTokenToName(token: PathToken) {
  return typeof token === 'string' ? token : token.name
}
