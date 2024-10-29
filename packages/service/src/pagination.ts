import * as jsonQS from '@json-qs/json-qs'
import { buildPath, parsePathParams } from 'pathic'
import type {
  BuildRouteParams,
  InferRouteParams,
  PathParams,
  RouteDefinition,
} from './types'

type PaginationLinkData<
  TPathParams extends PathParams,
  TData extends object,
> = {
  route: RouteDefinition<TPathParams, TData>
  params: BuildRouteParams<TPathParams, TData>
}

export type PaginationLinks<
  TPathParams extends PathParams,
  TData extends object,
> = {
  prev: PaginationLinkData<TPathParams, TData> | null
  next: PaginationLinkData<TPathParams, TData> | null
}

/**
 * Create a set of pagination links for a given route.
 *
 * The result should be returned from a route handler that's declared as an
 * async generator using the `async function*` syntax.
 *
 * For a route to paginate itself, it can call `paginate()` with `this` as
 * the first argument.
 */
export const paginate = <TDefinition extends RouteDefinition>(
  route: TDefinition,
  links: {
    prev: InferRouteParams<TDefinition> | null
    next: InferRouteParams<TDefinition> | null
  }
) => ({
  prev: links.prev && { route, params: links.prev },
  next: links.next && { route, params: links.next },
})

export function resolvePaginationLink(
  currentURL: URL,
  data: PaginationLinkData<any, any>
) {
  const query = jsonQS.encode(data.params, {
    skippedKeys: parsePathParams(data.route.path),
  })

  let path = buildPath(data.route.path, data.params)
  if (query) {
    path += '?' + query
  }

  const url = new URL(path, currentURL)
  return url.pathname.slice(1) + url.search
}
