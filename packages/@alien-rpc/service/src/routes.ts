import { InferParams } from '@alloc/path-types'
import { RequestContext } from '@hattip/compose'

export type Route<
  Path extends string,
  Handler extends (...args: any[]) => any,
> = {
  method: 'get' | 'post'
  path: Path
  handler: Handler
}

type GetHandler<
  PathParams extends object,
  SearchParams extends object,
  Result,
> = object extends PathParams
  ? PathParams extends Required<PathParams>
    ? (searchParams: SearchParams, request: RequestContext) => Result
    : (
        pathParams: PathParams,
        searchParams: SearchParams,
        request: RequestContext
      ) => Result
  : (
      pathParams: PathParams,
      searchParams: SearchParams,
      request: RequestContext
    ) => Result

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
