import * as jsonQS from '@json-qs/json-qs'
import { InferParams } from 'pathic'
import { JSONObjectCodable } from './internal/types.js'
import { PathParams, RouteHandler, RouteResult } from './types'

/**
 * Declare a DELETE route for your API. You *must* export the result for
 * your route to be activated. Search parameters are encoded with
 * `@json-qs/json-qs` to allow for any JSON-compatible type.
 */
export function DELETE<
  TPath extends string,
  TPathParams extends PathParams = InferParams<TPath>,
  TSearchParams extends jsonQS.DecodedObject = Record<string, never>,
  TResult extends RouteResult<TPathParams, TSearchParams> = any,
>(path: TPath, handler: RouteHandler<TPathParams, TSearchParams, TResult>) {
  return { method: 'DELETE', path, handler } as const
}

/**
 * Declare a GET route for your API. You *must* export the result for your
 * route to be activated. Search parameters are encoded with
 * `@json-qs/json-qs` to allow for any JSON-compatible type.
 */
export function GET<
  TPath extends string,
  TPathParams extends PathParams = InferParams<TPath>,
  TSearchParams extends jsonQS.DecodedObject = Record<string, never>,
  TResult extends RouteResult<TPathParams, TSearchParams> = any,
>(path: TPath, handler: RouteHandler<TPathParams, TSearchParams, TResult>) {
  return { method: 'GET', path, handler } as const
}

/**
 * Declare a HEAD route for your API. You *must* export the result for your
 * route to be activated. Search parameters are encoded with
 * `@json-qs/json-qs` to allow for any JSON-compatible type.
 */
export function HEAD<
  TPath extends string,
  TPathParams extends PathParams = InferParams<TPath>,
  TSearchParams extends jsonQS.DecodedObject = Record<string, never>,
  TResult extends RouteResult<TPathParams, TSearchParams> = any,
>(path: TPath, handler: RouteHandler<TPathParams, TSearchParams, TResult>) {
  return { method: 'HEAD', path, handler } as const
}

/**
 * Declare a PATCH route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export function PATCH<
  TPath extends string,
  TPathParams extends PathParams = InferParams<TPath>,
  TBody extends JSONObjectCodable = Record<string, never>,
  TResult extends RouteResult<TPathParams, TBody> = any,
>(path: TPath, handler: RouteHandler<TPathParams, TBody, TResult>) {
  return { method: 'PATCH', path, handler } as const
}

/**
 * Declare a POST route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export function POST<
  TPath extends string,
  TPathParams extends PathParams = InferParams<TPath>,
  TBody extends JSONObjectCodable = Record<string, never>,
  TResult extends RouteResult<TPathParams, TBody> = any,
>(path: TPath, handler: RouteHandler<TPathParams, TBody, TResult>) {
  return { method: 'POST', path, handler } as const
}

/**
 * Declare a PUT route for your API. You *must* export the result for your
 * route to be activated. The request body is encoded as JSON.
 */
export function PUT<
  TPath extends string,
  TPathParams extends PathParams = InferParams<TPath>,
  TBody extends JSONObjectCodable = Record<string, never>,
  TResult extends RouteResult<TPathParams, TBody> = any,
>(path: TPath, handler: RouteHandler<TPathParams, TBody, TResult>) {
  return { method: 'PUT', path, handler } as const
}

export {
  DELETE as delete,
  GET as get,
  HEAD as head,
  PATCH as patch,
  POST as post,
  PUT as put,
}
