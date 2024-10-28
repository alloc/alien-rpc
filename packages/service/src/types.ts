import { RequestContext } from '@hattip/compose'
import { TObject, TRecord, TSchema } from '@sinclair/typebox'
import * as t from './constraint'
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

export type RouteResultFormat = 'json' | 'json-seq' | 'response'

export type RouteIterator<TParams extends object = Record<string, JSON>> =
  AsyncIterator<JSON, PaginationLinks<TParams> | null | void>

export type RouteResult<TParams extends object = Record<string, JSON>> =
  Promisable<JSON | Response | RouteIterator<TParams> | void>

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
  pathParams?: readonly string[]
  format: RouteResultFormat
  requestSchema: TObject | TRecord
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

export type TypeConstraint = typeof t extends infer T
  ? InstanceType<
      Extract<T[keyof T], new (...args: any) => any>
    > extends infer TypeConstraint
    ? TypeConstraint
    : never
  : never

// type TypeConstraintKey = TypeConstraint extends infer TConstraint
//   ? TConstraint extends any
//     ? keyof TypeConstraint
//     : never
//   : never

// export type RemoveTypeConstraints<T> = T extends (infer TItem)[]
//   ? RemoveTypeConstraints<TItem>[]
//   : T extends readonly (infer TItem)[]
//     ? readonly RemoveTypeConstraints<TItem>[]
//     : T extends Primitive
//       ? Extract<Primitive, T>
//       : T extends Record<infer TKey, infer TValue> & TypeConstraint
//         ? Record<TKey, TValue>
//         : Extract<keyof T, TypeConstraintKey> extends never
//           ? T
//           : Omit<T, TypeConstraintKey>

// type T1 = RemoveTypeConstraints<Record<string, string> & t.MinProperties<1>>
// type T2 = RemoveTypeConstraints<(string & t.MinLength<1>)[] & t.MinItems<1>>
