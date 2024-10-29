import type { RouteMethod, RouteResultFormat } from '@alien-rpc/route'
import type { RequestContext } from '@hattip/compose'
import type * as jsonQS from '@json-qs/json-qs'
import type { TObject, TRecord, TSchema } from '@sinclair/typebox'
import type { JSON, Promisable } from './internal/types'
import type { PaginationLinks } from './pagination'

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

export type RouteIterator<
  TPathParams extends PathParams = any,
  TData extends object = any,
> = AsyncIterator<JSON, PaginationLinks<TPathParams, TData> | null | void>

export type RouteResult<
  TPathParams extends PathParams = any,
  TData extends object = any,
> = Promisable<JSON | Response | RouteIterator<TPathParams, TData> | void>

export type RouteHandler<
  TPathParams extends PathParams = any,
  TData extends object = any,
  TResult extends RouteResult<TPathParams, TData> = any,
> = (
  this: NoInfer<RouteDefinition<TPathParams, TData>>,
  params: TPathParams,
  data: TData,
  ctx: RequestContext
) => TResult

export interface RouteDefinition<
  TPathParams extends PathParams = any,
  TData extends object = any,
  TResult extends RouteResult<TPathParams, TData> = any,
> {
  method: RouteMethod
  path: string
  handler: RouteHandler<TPathParams, TData, TResult>
}

/**
 * A route definition enhanced with compile-time metadata.
 */
export interface Route<TDefinition extends RouteDefinition = RouteDefinition> {
  method: RouteMethod
  path: string
  import: () => Promise<TDefinition>
  pathParams?: readonly string[]
  format: RouteResultFormat
  pathSchema?: TObject
  requestSchema: TObject | TRecord
  responseSchema: TSchema
}

export type PathParams = {
  [key: string]: string | number | (string | number)[]
}

export type BuildRouteParams<
  TPathParams extends PathParams,
  TData extends object,
> =
  TPathParams extends Record<string, never>
    ? TData extends Record<string, never>
      ? Record<string, never>
      : TData
    : TData extends Record<string, never>
      ? TPathParams
      : TPathParams & TData

export type InferRouteParams<T extends { handler: any }> =
  T['handler'] extends (
    pathParams: infer TPathParams extends PathParams,
    data: infer TData extends jsonQS.DecodedObject,
    ...rest: any[]
  ) => any
    ? BuildRouteParams<TPathParams, TData>
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
