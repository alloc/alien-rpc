import * as jsonQS from '@json-qs/json-qs'
import { buildPath, parsePathParams } from 'pathic'
import type { InferRouteParams, RouteDefinition } from './types'

export type PaginationLink<
  TParams extends jsonQS.CodableObject = jsonQS.CodableObject,
> = {
  route: RouteDefinition
  params: TParams | null
}

export type PaginationLinks<
  TParams extends jsonQS.CodableObject = jsonQS.CodableObject,
> = {
  prev: PaginationLink<TParams> | null
  next: PaginationLink<TParams> | null
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
export const paginate = <
  TDefinition extends RouteDefinition,
  TParams extends InferRouteParams<TDefinition>,
>(
  route: TDefinition,
  links: {
    prev: TParams | null
    next: TParams | null
  }
): PaginationLinks<TParams> => ({
  prev: links.prev && { route, params: links.prev },
  next: links.next && { route, params: links.next },
})

export function resolvePaginationLink(currentURL: URL, data: PaginationLink) {
  const query = jsonQS.encode(data.params!, {
    skippedKeys: parsePathParams(data.route.path),
  })

  let path = buildPath(data.route.path, data.params!)
  if (query) {
    path += '?' + query
  }

  const url = new URL(path, currentURL)
  return url.pathname.slice(1) + url.search
}
