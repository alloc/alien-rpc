import { Static, Type } from '@sinclair/typebox'
import * as jsonQS from 'json-qs'
import { ParamData } from 'path-to-regexp'
import {
  getRouteData,
  parseRoutePathParams,
  renderRoutePath,
} from './routeMetadata'
import { JsonValue } from './typebox/json'
import type { InferRouteParams } from './types'

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
  const route = getRouteData(data.route)
  if (!route) {
    throw new Error('Cannot resolve pagination link for uncompiled route.')
  }
  if (route.method !== 'get') {
    throw new Error('Pagination links are only supported for GET routes.')
  }

  const pathParams = parseRoutePathParams(data.route)
  const query = jsonQS.encode(data.params, {
    skippedKeys: pathParams,
  })

  let path = renderRoutePath(data.route, data.params as ParamData)
  if (query) {
    path += '?' + query
  }

  return new URL(path, currentURL).pathname
}
