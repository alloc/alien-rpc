import { InferParams } from '@alloc/path-types'
import { RequestContext } from '@hattip/compose'

export function get<
  Path extends string,
  SearchParams extends object = {},
  Result = unknown,
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

export function post<
  Path extends string,
  Body extends object = {},
  Result = unknown,
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
