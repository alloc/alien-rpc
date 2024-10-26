import * as jsonQS from '@json-qs/json-qs'
import { Static, Type } from '@sinclair/typebox'
import { JsonValue } from './typebox/json'
import type { InferRouteParams } from './types'
import { buildPath, parsePathParams } from 'pathic'

// The object created by the `get` and `post` functions.
const RouteDefinition = Type.Object(
  {
    method: Type.String(),
    path: Type.String(),
    handler: Type.Unknown(),
  },
  { additionalProperties: false }
)

const PaginationLinkParams = Type.Record(Type.String(), JsonValue())

/**
 * If a pagination link is defined without a route, the current route is
 * used. Either way, the pagination link is formed with a URL and a set of
 * search parameters. Only GET routes are supported.
 */
const PaginationLinkData = Type.Object(
  {
    route: RouteDefinition,
    params: PaginationLinkParams,
  },
  { additionalProperties: false }
)

type RouteDefinition = Static<typeof RouteDefinition>
type PaginationLinkParams = Static<typeof PaginationLinkParams>
type PaginationLinkData = Static<typeof PaginationLinkData>

export type PaginationLinks<TParams extends object = object> = {
  prev: { route: RouteDefinition; params: TParams } | null
  next: { route: RouteDefinition; params: TParams } | null
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
  } satisfies PaginationLinks
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
