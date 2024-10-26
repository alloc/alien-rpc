import type { PathTemplate } from '@alloc/path-types'
import type { Client } from './client.js'

type AnyFn = (...args: any) => any

export type RpcMethod = 'get' | 'post'

export type RpcResultFormat = 'json' | 'json-seq' | 'response'

export type RpcCachedResult<TResult> =
  TResult extends ResponseStream<infer TStreamResult>
    ? readonly TStreamResult[] | readonly [...TStreamResult[], RpcPagination]
    : TResult

export type RpcResultFormatter<
  TResult = unknown,
  TCachedResult = Awaited<TResult>,
> = {
  mapCachedResult: (value: TCachedResult, client: Client) => TResult
  parseResponse(promisedResponse: Promise<Response>, client: Client): TResult
}

export type RpcRoute<
  TPath extends string = string,
  TCallee extends AnyFn = AnyFn,
> = {
  method: RpcMethod
  path: TPath
  pathParams: string[]
  /**
   * The result format determines how the response must be handled for the
   * caller to receive the expected type.
   */
  format: string | RpcResultFormatter<Awaited<ReturnType<TCallee>>, any>
  /**
   * Equals 1 if the route has no search parameters or request body.
   */
  arity: 1 | 2
  /**
   * The route's signature type. This property never actually exists at
   * runtime.
   */
  callee: TCallee
}

/**
 * Any valid URI pathname for the given route interface.
 */
export type RpcPathname<TRoutes extends Record<string, RpcRoute>> =
  TRoutes[keyof TRoutes] extends RpcRoute<infer TEndpointPath>
    ? PathTemplate<TEndpointPath>
    : never

/**
 * The response type for the given URI pathname and route interface.
 */
export type RpcResponseByPath<
  TRoutes extends Record<string, RpcRoute>,
  TPath extends string,
> = {
  [K in keyof TRoutes]: TRoutes[K] extends RpcRoute<infer P>
    ? TPath extends PathTemplate<P>
      ? TRoutes[K]
      : never
    : never
}[keyof TRoutes]

/**
 * Pagination links (relative to the client prefix URL) are received at the
 * end of a JSON text sequence for routes that use the `paginate` utility
 * of alien-rpc. These links are used by the `previousPage` and `nextPage`
 * methods of the returned async generator.
 *
 * Note that page requests are sent to `GET` routes.
 */
export type RpcPagination = {
  $prev: string | null
  $next: string | null
}

export type { InferParams, PathTemplate } from '@alloc/path-types'

export type ClientOptions = Omit<
  import('ky').Options,
  'method' | 'body' | 'json' | 'searchParams'
> & {
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
  resultCache?: RpcResultCache
}

export type RequestOptions = Omit<ClientOptions, 'prefixUrl'>

export type RequestParams<
  TPathParams extends object,
  TSearchParams extends object,
> =
  | MergeParams<TPathParams, TSearchParams>
  | (HasNoRequiredKeys<TSearchParams> extends true
      ? HasSingleKey<TPathParams> extends true
        ? Exclude<
            ExcludeObject<TPathParams[keyof TPathParams]>,
            null | undefined
          >
        : never
      : never)

type HasNoRequiredKeys<T extends object> = object extends T
  ? true
  : Record<string, never> extends T
    ? true
    : false

/**
 * Exclude object types from the type, except for arrays.
 */
type ExcludeObject<T> = T extends object
  ? T extends readonly any[]
    ? T
    : never
  : T

/**
 * Merge two object types, with handling of `Record<string, never>` being
 * used to represent an empty object.
 */
type MergeParams<TLeft extends object, TRight extends object> =
  TLeft extends Record<string, never>
    ? TRight
    : TRight extends Record<string, never>
      ? TLeft
      : TLeft & TRight

/**
 * Return true if type `T` has a single property.
 */
type HasSingleKey<T extends object> = keyof T extends infer TKey
  ? TKey extends any
    ? keyof T extends TKey
      ? true
      : false
    : never
  : never

export type { ResponsePromise } from 'ky'

export interface ResponseStream<T> extends AsyncIterableIterator<T> {
  /**
   * Fetch the next page of results. Exists only if there is a next page and
   * after the current stream has been fully consumed.
   */
  nextPage?: (options?: RequestOptions) => ResponseStream<T>
  /**
   * Fetch the previous page of results. Exists only if there is a previous page
   * and after the current stream has been fully consumed.
   */
  previousPage?: (options?: RequestOptions) => ResponseStream<T>
}

export interface RpcResultCache {
  has: (path: string) => boolean
  get: (path: string) => unknown | undefined
  set: (path: string, response: unknown) => void
}
