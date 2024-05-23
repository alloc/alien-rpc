import * as Type from 'typebox/type'
import { Nullable } from './nullable'

export const RpcPagination = Type.Object({
  prev: Nullable(Type.String()),
  next: Nullable(Type.String()),
})

export type TRpcPagination = typeof RpcPagination
