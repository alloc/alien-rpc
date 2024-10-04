import {
  Static,
  TFunction,
  TNull,
  TObject,
  TSchema,
  TUint8Array,
  TUnion,
} from '@sinclair/typebox/type'
import { InferParams } from 'path-types'
import { Type } from './typebox'
import {
  TJsonObject,
  TJsonProperties,
  TJsonValue,
  TNullable,
  TOptions,
  TRpcPagination,
} from './typebox/type'

export type RpcEndpointType = 'json' | 'ndjson' | 'text' | 'blob'

export type RpcPagination = Static<TRpcPagination>
export type RpcPaginator<T extends TSchema> = unknown &
  AsyncGenerator<T, TRpcPagination>

export class RpcEndpoint<
  Path extends string = string,
  TArgs extends TSchema[] = [],
  TReturn extends TReturnValue = TNull,
> {
  protected _args: TArgs = [] as any
  protected _return: TReturn = Type.Null() as any
  protected _type: RpcEndpointType = 'json'

  constructor(
    protected _method: string,
    protected _path: Path
  ) {}

  /**
   * Append a single, required `object` argument to the endpoint.
   */
  object<T extends TJsonProperties>(
    properties: T
  ): RpcEndpoint<Path, [...TArgs, TObject<T>], TReturn> {
    return this.args(Type.Object(properties))
  }

  /**
   * Append a single, optional `object` argument to the endpoint. All properties
   * are optional, as well as the object itself.
   */
  options<T extends TJsonProperties>(
    options: T
  ): RpcEndpoint<Path, [...TArgs, options: TNullable<TOptions<T>>], TReturn> {
    return this.args(Type.Nullable(Type.Options(options)))
  }

  /**
   * Append a single, required `JsonValue` argument to the endpoint. You can use
   * the `Nullable` type to make it optional.
   */
  arg<TNewArg1 extends TJsonValue>(
    schema: TNewArg1
  ): RpcEndpoint<Path, [...TArgs, TNewArg1], TReturn> {
    return this.args(schema)
  }

  /**
   * Append multiple, required `JsonValue` arguments to the endpoint. You can
   * use the `Nullable` type to make any of them optional.
   */
  args<TNewArg1 extends TJsonValue, TNewArgs extends TJsonValue[]>(
    schema: TNewArg1,
    ...schemas: TNewArgs
  ): RpcEndpoint<Path, [...TArgs, TNewArg1, ...TNewArgs], TReturn>

  args(
    ...schemas: [TJsonValue, ...TJsonValue[]]
  ): RpcEndpoint<Path, any, TReturn> {
    this._args = [...this._args, ...schemas] as any
    return this
  }

  /**
   * An endpoint that responds with a JSON value. If you call this, you should
   * **NOT** also call `stream`, `text`, or `blob`.
   */
  return<TReturn extends TJsonValue>(
    schema: TReturn
  ): RpcEndpoint<Path, TArgs, TReturn> {
    this._return = schema as any
    return this as any
  }

  /**
   * Like `.return()` but takes varargs and wraps them with `Type.Union()`
   */
  returnUnion<TReturn extends [TJsonValue, ...TJsonValue[]]>(
    ...schemas: TReturn
  ): RpcEndpoint<Path, TArgs, TUnion<TReturn>> {
    return this.return(Type.Union<TReturn>(schemas) as TUnion<TReturn>)
  }

  /**
   * An endpoint that streams JSON values in a newline-delimited format and
   * provides pagination links. If you call this, you should **NOT** also call
   * `return`, `text`, `stream`, or `blob`.
   *
   * It uses a `Content-Type` of `text/plain; charset=utf-8` until a standard
   * `application/x-ndjson` is widely supported.
   * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1603986
   */
  stream<TReturn extends TJsonValue>(
    schema: TReturn
  ): RpcEndpoint<Path, TArgs, RpcPaginator<TReturn>> {
    return this.asyncIterable(schema, 'ndjson') as any
  }

  /**
   * An endpoint that streams UTF-8 text. If you call this, you should **NOT**
   * also call `return`, `stream`, `paginate`, or `blob`.
   */
  text() {
    return this.asyncIterable(Type.String(), 'text')
  }

  /**
   * An endpoint that streams binary data. If you call this, you should **NOT**
   * also call `return`, `stream`, `paginate`, or `text`.
   */
  blob() {
    return this.asyncIterable(Type.Uint8Array(), 'blob')
  }

  protected asyncIterable<TReturn extends TJsonValue | TUint8Array>(
    schema: TReturn,
    type: RpcEndpointType
  ): RpcEndpoint<Path, TArgs, AsyncIterable<TReturn>> {
    this._type = type
    return this.return(schema as any)
  }

  get schema(): TFunction<
    TArgs,
    TReturn extends AsyncIterable<infer T> ? T : TReturn
  > {
    return Type.Function(this._args, this._return as TJsonValue) as any
  }

  toJSON() {
    return {
      method: this._method,
      path: this._path,
      type: this._type,
      schema: this.schema,
    }
  }
}

export interface RpcEndpoint<
  Path extends string,
  TArgs extends TSchema[],
  TReturn extends TReturnValue,
> {
  /**
   * Not an actual method. Useful for a better error message from TypeScript when an object isn't
   * satisfying the JSON-compatibility requirement.
   * @deprecated
   */
  returnObject<TReturn extends TJsonObject>(schema: TReturn): never
}

/**
 * This type is used to infer whether the first argument of an endpoint is a route parameters object
 * or not.
 *
 * When an endpoint has route parameters (i.e. `/users/:id`), the `params` object must be the first
 * argument of a client call. This type resolves to an empty array if the endpoint does not have any
 * route parameters; otherwise, it resolves to an argument list containing only the expected
 * `params` object for the given `Path` string.
 *
 * It's expected that this type will be spread with `...` before the endpoint's declared arguments
 * (as of this writing, that is done within the {@link RpcFunction} type).
 */
export type TParams<Path extends string, Value> =
  InferParams<Path> extends infer Params
    ? {} extends Params
      ? []
      : [
          params: [Value] extends [TSchema]
            ? TObject<{ [P in keyof Params]: Value }>
            : { [P in keyof Params]: Value },
        ]
    : never

export type TReturnValue =
  | TSchema
  | AsyncIterable<TSchema>
  | RpcPaginator<TSchema>

const endpoint =
  (method: string) =>
  <Path extends string>(path: Path) =>
    new RpcEndpoint(method, path)

export const del = /* @__PURE__ */ endpoint('DELETE')
export const get = /* @__PURE__ */ endpoint('GET')
export const patch = /* @__PURE__ */ endpoint('PATCH')
export const post = /* @__PURE__ */ endpoint('POST')
export const put = /* @__PURE__ */ endpoint('PUT')
