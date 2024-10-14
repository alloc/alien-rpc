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

export interface RouteDefinition<
  PathParams extends object = object,
  Data extends object = object,
> {
  method: RouteMethod
  path: string
  handler: (
    this: NoInfer<RouteDefinition<PathParams, Data>>,
    params: PathParams,
    data: Data,
    ctx: RequestContext
  ) => RouteResult
}

/**
 * A route definition enhanced with compile-time metadata.
 */
export interface Route {
  def: RouteDefinition
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

export type RouteResponder<TResult extends RouteResult = RouteResult> = (
  handler: (params: any, data: any, ctx: RequestContext) => TResult,
  route: Route
) => (params: any, data: any, ctx: RequestContext) => Promise<Response>
