export type RouteMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RouteResultFormat = 'json' | 'json-seq' | 'response'

export const bodylessMethods = new Set<RouteMethod>(['GET', 'HEAD', 'DELETE'])
