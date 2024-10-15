import { InferParams } from '@alloc/path-types'
import { RequestContext } from '@hattip/compose'
import { BuildRouteParams, RouteDefinition, RouteResult } from './types'

type ValidResult<TPath extends string, TData extends object> = RouteResult<
  BuildRouteParams<InferParams<TPath>, TData>
>

/**
 * Declare a GET route for your API. You *must* export the result for your
 * route to be activated. Complex search parameters are specially encoded
 * to enable your route to receive them.
 */
export function get<
  TPath extends string,
  TSearch extends object = Record<string, never>,
  TResult extends ValidResult<TPath, TSearch> = any,
>(
  path: TPath,
  handler: (
    this: NoInfer<RouteDefinition<InferParams<TPath>, TSearch>>,
    pathParams: InferParams<TPath>,
    searchParams: TSearch,
    request: RequestContext
  ) => TResult
) {
  return { method: 'get', path, handler } as const
}

/**
 * Declare a POST route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export function post<
  TPath extends string,
  TBody extends object = Record<string, never>,
  TResult extends ValidResult<TPath, TBody> = any,
>(
  path: TPath,
  handler: (
    this: NoInfer<RouteDefinition<InferParams<TPath>, TBody>>,
    pathParams: InferParams<TPath>,
    body: TBody,
    request: RequestContext
  ) => TResult
) {
  return { method: 'post', path, handler } as const
}
