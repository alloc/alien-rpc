export type RouteMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RouteResultFormat = 'json' | 'json-seq' | 'response'

export const cacheableMethods = new Set<RouteMethod>(['GET', 'HEAD'])

export const bodylessMethods = new Set<RouteMethod>([
  ...cacheableMethods,
  'DELETE',
])
