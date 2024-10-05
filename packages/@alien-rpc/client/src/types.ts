import { PathTemplate } from 'path-types'

type AnyFn = (...args: any) => any

export type RpcEndpointMethod = 'get' | 'post'
export type RpcEndpointType = 'json' | 'ndjson' | 'text' | 'blob'
export type RpcEndpoint<
  Path extends string = string,
  Callee extends AnyFn = AnyFn,
> = {
  method: RpcEndpointMethod
  path: Path
  type: RpcEndpointType
  callee: Callee
}

/**
 * Any valid URI pathname for the given route interface.
 */
export type RpcEndpointPath<TRouteInterface extends object> =
  TRouteInterface[keyof TRouteInterface] extends RpcEndpoint<
    infer TEndpointPath
  >
    ? PathTemplate<TEndpointPath>
    : never

/**
 * The response type for the given URI pathname and route interface.
 */
export type RpcResponseByPath<
  TRouteInterface extends object,
  TGivenPath extends string,
> = keyof TRouteInterface extends infer TRouteName
  ? TRouteName extends keyof TRouteInterface
    ? TRouteInterface[TRouteName] extends RpcEndpoint<infer TEndpointPath>
      ? TGivenPath extends PathTemplate<TEndpointPath>
        ? TRouteInterface[TRouteName]
        : never
      : never
    : never
  : never
