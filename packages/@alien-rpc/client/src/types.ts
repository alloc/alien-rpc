import { PathTemplate } from '@alloc/path-types'

type AnyFn = (...args: any) => any

export type RpcMethod = 'get' | 'post'

export type RpcResponseFormat = 'json' | 'ndjson' | 'response'

export type RpcRoute<
  Path extends string = string,
  Callee extends AnyFn = AnyFn,
> = {
  method: RpcMethod
  path: Path
  /**
   * The response format determines how the response must be handled for
   * the caller to receive the expected type.
   */
  format: RpcResponseFormat
  /**
   * Equals 1 if the route has no search parameters or request body.
   */
  arity: 1 | 2
  /**
   * Exists for GET routes and is non-empty for routes with search
   * parameters that may be a string or some other type. This ensures the
   * string values are JSON encoded to ensure parse-ability.
   */
  jsonParams?: string[]
  /**
   * The route's signature type. This property never actually exists at
   * runtime.
   */
  callee: Callee
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
 * The backend defines pagination links by returning objects that are
 * converted to URL search params.
 */
export type RpcPagination = {
  prev: Record<string, any> | null
  next: Record<string, any> | null
}

export type { InferParams, PathTemplate } from '@alloc/path-types'

export type RequestOptions = Omit<
  import('ky').Options,
  'method' | 'body' | 'json' | 'searchParams' | 'prefixUrl'
>

export type RequestParams<
  TPathParams extends object,
  TSearchParams extends object,
> =
  | (TPathParams & TSearchParams)
  | (object extends TSearchParams
      ? HasSingleKey<TPathParams> extends true
        ?
            | Exclude<TPathParams[keyof TPathParams], object>
            | Extract<TPathParams[keyof TPathParams], readonly any[]>
        : never
      : never)

type HasSingleKey<T extends object> = keyof T extends infer TKey
  ? TKey extends any
    ? keyof T extends TKey
      ? true
      : false
    : false
  : false

export type { ResponsePromise } from 'ky'

export interface ResponseStream<T> extends AsyncIterableIterator<T> {
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

export interface ResponseCache {
  get: (path: string) => unknown | undefined
  set: (path: string, response: unknown) => void
}
