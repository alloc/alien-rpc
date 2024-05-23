import { TReturnValue } from 'alien-rpc'
import { TJsonValue, TRpcPagination } from 'alien-rpc/typebox'
import { Static, TSchema } from 'typebox'
import { RpcPaginationResult } from './function'

export type Promisable<T> = T | PromiseLike<T>

export type StaticArgs<Args extends TSchema[]> = {
  [Index in keyof Args]: Static<Args[Index]> extends infer Arg
    ? Exclude<Arg, null> | (null extends Arg ? undefined : never)
    : never
}

type OptionalReturn<T> = null extends T ? T | void : T

/**
 * The runtime type of a server function's return value.
 */
export type StaticReturn<T extends TReturnValue> =
  | (T extends AsyncGenerator<infer Value extends TJsonValue, TRpcPagination>
      ? AsyncGenerator<Static<Value>, RpcPaginationResult | null | void>
      : T extends AsyncIterable<infer Value extends TSchema>
        ? AsyncIterable<Static<Value>>
        : never)
  | (Extract<T, TSchema> extends infer Value extends TSchema
      ? OptionalReturn<Static<Value>>
      : never)
