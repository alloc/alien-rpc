import type { RpcResultFormat } from '@alien-rpc/client'
import { Type } from '@alien-rpc/typebox'
import { RequestContext } from '@hattip/compose'
import { TObject, TSchema } from '@sinclair/typebox'
import { JSON, Promisable } from './internal/types'
import { PaginationLinks } from './pagination'

declare module '@hattip/compose' {
  interface RequestContextExtensions {
    /**
     * Manipulate the HTTP response by editing this.
     */
    response: {
      /**
       * Set the HTTP status code.
       *
       * @default 200
       */
      status: number
      /**
       * Add your own HTTP response headers.
       *
       * Content-Type and Content-Length are set for you automatically.
       */
      headers: Headers
    }
  }
}

export type RouteMethod = 'get' | 'post'

export type RouteIterator<
  TParams extends object = Record<string, Type.JsonValue>,
> = AsyncIterator<JSON, PaginationLinks<TParams> | null | void>

export type RouteResult<
  TParams extends object = Record<string, Type.JsonValue>,
> = Promisable<JSON | Response | RouteIterator<TParams> | void>

export type RouteHandler<
  TParams extends object = object,
  TData extends object = object,
  TResult extends RouteResult<any> = RouteResult,
> = (
  this: NoInfer<RouteDefinition<TParams, TData>>,
  params: TParams,
  data: TData,
  ctx: RequestContext
) => TResult

export interface RouteDefinition<
  TParams extends object = any,
  TData extends object = any,
  TResult extends RouteResult<any> = any,
> {
  method: RouteMethod
  path: string
  handler: RouteHandler<TParams, TData, TResult>
}

/**
 * A route definition enhanced with compile-time metadata.
 */
export interface Route<TDefinition extends RouteDefinition = RouteDefinition> {
  method: RouteMethod
  path: string
  import: () => Promise<TDefinition>
  /** Exists on GET routes only. */
  jsonParams?: string[]
  pathParams?: string[]
  format: RpcResultFormat
  requestSchema: TObject
  responseSchema: TSchema
}

export type BuildRouteParams<PathParams extends object, Data extends object> =
  PathParams extends Record<string, never>
    ? Data extends Record<string, never>
      ? Record<string, never>
      : Data
    : Data extends Record<string, never>
      ? PathParams
      : PathParams & Data

export type InferRouteParams<T extends { handler: any }> =
  T['handler'] extends (
    pathParams: infer PathParams extends object,
    data: infer Data extends object,
    ...rest: any[]
  ) => any
    ? BuildRouteParams<PathParams, Data>
    : never

export type RouteResponder<
  TDefinition extends RouteDefinition = RouteDefinition,
> = (
  route: Route<TDefinition>
) => (
  params: TDefinition extends RouteDefinition<infer TParams> ? TParams : never,
  data: TDefinition extends RouteDefinition<any, infer TData> ? TData : never,
  ctx: RequestContext
) => Promise<Response>
