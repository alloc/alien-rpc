import { juri } from '@alien-rpc/juri'
import ky, { Options as RequestOptions } from 'ky'
import { parse, Token as PathToken, tokensToFunction } from 'path-to-regexp'
import { RpcEndpoint, RpcEndpointPath, RpcResponseByPath } from './types'

export type { InferParams, PathTemplate } from 'path-types'

type StaticArgs<Args extends TSchema[]> = {
  [Index in keyof Args]: Static<Args[Index]> extends infer Arg
    ? Arg extends (infer Item)[]
      ? Optional<Item>[]
      : Arg extends object
        ? { [Key in keyof Arg]: Optional<Arg[Key]> }
        : Optional<Arg>
    : never
} extends infer Args extends any[]
  ? OptionalArgs<Args>
  : never

/** Add `null` as a valid type if `undefined` is valid. */
type Optional<T> = undefined extends T ? T | null : T

/** Treat nullable arguments as optional. */
type OptionalArgs<Args extends any[]> = Args extends [...infer Rest, infer Last]
  ? null extends Last
    ? OptionalArgs<Rest> | [...Required<Rest>, Last]
    : Args
  : Args extends [infer Last | null]
    ? [] | [Last]
    : Args

type ArrayConcat<T extends any[], U extends any[]> = T extends any[]
  ? [...T, ...U]
  : never

export interface ResponseStream<T> extends AsyncIterable<T> {
  /**
   * Fetch the next page of results. Exists only if there is a next page and
   * after the current stream has been fully consumed.
   */
  nextPage?: () => ResponseStream<T>
  /**
   * Fetch the previous page of results. Exists only if there is a previous page
   * and after the current stream has been fully consumed.
   */
  previousPage?: () => ResponseStream<T>
}

export type Client<TRouteInterface extends object> = {
  extend: (defaults: RequestOptions) => Client<TRouteInterface>
  setResponse: <P extends RpcEndpointPath<TRouteInterface>>(
    path: P,
    response: Awaited<RpcResponseByPath<TRouteInterface, P>>
  ) => void
} & {
  [TRouteName in keyof TRouteInterface]: Extract<
    TRouteInterface[TRouteName],
    RpcEndpoint
  >['callee']
}

export function defineClient<API extends object>(
  endpoints: Record<string, Endpoint>,
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
        const requiredParams = getRequiredParams(endpoint.schema.parameters)
        const pathTokens = parse(endpoint.path)
        const firstParamName = pathTokenToName(pathTokens[0])
        const path = pathTokens.length > 1 && tokensToFunction(pathTokens)
        const type = endpoint.type as RpcEndpointType

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

          if (endpoint.method === 'GET') {
            const searchParams = encodeJsonSearch(args[0])
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
            endpoint.method !== 'GET' && {
              // Send single arguments without an array wrapper.
              json:
                args.length !== 1 || Array.isArray(args[0]) ? args : args[0],
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

function isPagination(object: object): object is RpcPagination {
  // The server ensures both `prev` and `next` are defined, even though the
  // RpcPagination type says otherwise.
  return (
    (object as any).prev !== undefined &&
    (object as any).next !== undefined &&
    Object.keys(object).length === 2
  )
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

export type RequestOptions = Options

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
