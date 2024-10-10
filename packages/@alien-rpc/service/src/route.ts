import { InferParams } from '@alloc/path-types'
import { RequestContext } from '@hattip/compose'
import { ValidResult } from './types'

type EmptyRecord = Record<keyof any, never>

/**
 * Declare a GET route for your API. You *must* export the result for your
 * route to be activated. Complex search parameters are specially encoded
 * to enable your route to receive them.
 */
export function get<
  Path extends string,
  SearchParams extends object = EmptyRecord,
  Result extends ValidResult = any,
>(
  path: Path,
  handler: (
    pathParams: InferParams<Path>,
    searchParams: SearchParams,
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
  Body extends object = EmptyRecord,
  Result extends ValidResult = any,
>(
  path: Path,
  handler: (
    pathParams: InferParams<Path>,
    body: Body,
    request: RequestContext
  ) => Result
) {
  return { method: 'post', path, handler } as const
}
