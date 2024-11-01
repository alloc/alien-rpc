import { RouteMethod } from '@alien-rpc/route'
import { InferParamsArray } from 'pathic'
import {
  FixedRouteHandler,
  MultiParamRouteHandler,
  MultiParamRoutePath,
  PathParam,
  RouteDefinition,
  RouteResult,
  SingleParamRouteHandler,
  SingleParamRoutePath,
} from './types'

/**
 * Declare a DELETE route for your API. You *must* export the result for
 * your route to be activated. Search parameters are encoded with
 * `@json-qs/json-qs` to allow for any JSON-compatible type.
 */
export const DELETE = defineBodylessRoute('DELETE')

/**
 * Declare a GET route for your API. You *must* export the result for your
 * route to be activated. Search parameters are encoded with
 * `@json-qs/json-qs` to allow for any JSON-compatible type.
 */
export const GET = defineBodylessRoute('GET')

/**
 * Declare a HEAD route for your API. You *must* export the result for your
 * route to be activated. Search parameters are encoded with
 * `@json-qs/json-qs` to allow for any JSON-compatible type.
 */
export const HEAD = defineBodylessRoute('HEAD')

/**
 * Declare a PATCH route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export const PATCH = defineJSONRoute('PATCH')

/**
 * Declare a POST route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export const POST = defineJSONRoute('POST')

/**
 * Declare a PUT route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export const PUT = defineJSONRoute('PUT')

export {
  DELETE as delete,
  GET as get,
  HEAD as head,
  PATCH as patch,
  POST as post,
  PUT as put,
}

function defineBodylessRoute<TMethod extends RouteMethod>(
  method: TMethod
): RouteFactory<TMethod> {
  return (path: string, handler: any) => ({ method, path, handler })
}

function defineJSONRoute<TMethod extends RouteMethod>(
  method: TMethod
): RouteFactory<TMethod> {
  return (path: string, handler: any) => ({ method, path, handler })
}

type RouteFactory<TMethod extends RouteMethod> = {
  // Overload: Multiple path parameters
  <
    TPath extends MultiParamRoutePath,
    TPathParams extends InferParamsArray<TPath, PathParam> = InferParamsArray<
      TPath,
      any
    >,
    TData extends object = any,
    TPlatform = unknown,
    TResult extends RouteResult = any,
  >(
    path: TPath,
    handler: MultiParamRouteHandler<
      TPath,
      TPathParams,
      TData,
      TPlatform,
      TResult
    >
  ): RouteDefinition<TPath, Parameters<typeof handler>, TResult, TMethod>

  // Overload: Single path parameter
  <
    TPath extends SingleParamRoutePath,
    TPathParam extends PathParam = any,
    TData extends object = any,
    TPlatform = unknown,
    TResult extends RouteResult = any,
  >(
    path: TPath,
    handler: SingleParamRouteHandler<
      TPath,
      TPathParam,
      TData,
      TPlatform,
      TResult
    >
  ): RouteDefinition<TPath, Parameters<typeof handler>, TResult, TMethod>

  // Overload: Fixed path
  <
    TPath extends string,
    TData extends object = any,
    TPlatform = unknown,
    TResult extends RouteResult = any,
  >(
    path: TPath,
    handler: FixedRouteHandler<TPath, TData, TPlatform, TResult>
  ): RouteDefinition<TPath, Parameters<typeof handler>, TResult, TMethod>
}
