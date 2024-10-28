import * as jsonQS from '@json-qs/json-qs'
import { buildPath, parsePathParams } from 'pathic'
import type { InferRouteParams, RouteDefinition } from './types'

export type PaginationLinkData<
  TParams extends jsonQS.CodableRecord = jsonQS.CodableRecord,
> = {
  route: RouteDefinition
  params: TParams
}

export type PaginationLinks<
  TParams extends jsonQS.CodableRecord = jsonQS.CodableRecord,
> = {
  prev: PaginationLinkData<TParams> | null
  next: PaginationLinkData<TParams> | null
}

export function paginate<T extends RouteDefinition>(
  route: T,
  links: {
    prev: InferRouteParams<T> | null
    next: InferRouteParams<T> | null
  }
) {
  return {
    prev: links.prev && { route, params: links.prev },
    next: links.next && { route, params: links.next },
  } satisfies PaginationLinks<any>
}

export function resolvePaginationLink(
  currentURL: URL,
  data: PaginationLinkData
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
