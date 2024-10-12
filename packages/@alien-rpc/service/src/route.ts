import { InferParams } from '@alloc/path-types'
import { RequestContext } from '@hattip/compose'
import { BuildRouteParams, RouteDefinition, RouteResult } from './types'

/**
 * Declare a GET route for your API. You *must* export the result for your
 * route to be activated. Complex search parameters are specially encoded
 * to enable your route to receive them.
 */
export function get<
  Path extends string,
  Search extends object = Record<string, never>,
  Result extends RouteResult<BuildRouteParams<InferParams<Path>, Search>> = any,
>(
  path: Path,
  handler: (
    this: NoInfer<RouteDefinition<InferParams<Path>, Search>>,
    pathParams: InferParams<Path>,
    searchParams: Search,
    request: RequestContext
  ) => Result
) {
  return { method: 'get', path, handler } as const
}

/**
 * Declare a POST route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export function post<
  Path extends string,
  Body extends object = Record<string, never>,
  Result extends RouteResult<BuildRouteParams<InferParams<Path>, Body>> = any,
>(
  path: Path,
  handler: (
    this: NoInfer<RouteDefinition<InferParams<Path>, Body>>,
    pathParams: InferParams<Path>,
    body: Body,
    request: RequestContext
  ) => Result
) {
  return { method: 'post', path, handler } as const
}
