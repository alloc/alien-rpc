import { RequestContext } from '@hattip/compose'
import { TString } from 'typebox'
import { RpcEndpoint, TParams } from '../../alien-rpc/src/endpoint'
import { Promisable, StaticArgs, StaticReturn } from './types'

export type RpcFunction<T> =
  T extends RpcEndpoint<infer Path, infer TArgs, infer TReturn>
    ? (
        this: RpcContext,
        ...args: StaticArgs<[...TParams<Path, TString>, ...TArgs]>
      ) => Promisable<StaticReturn<TReturn>>
    : never

/**
 * The `@hattip/compose` request context, with a `response` property that the server function may
 * mutate to control the HTTP response.
 */
export type RpcContext<P = unknown> = RequestContext<P> & {
  response: {
    status: number
    headers: Headers
  }
}

/**
 * The backend defines pagination links by returning objects that are converted
 * to URL search params.
 */
export type RpcPaginationResult = {
  prev?: Record<string, any> | null
  next?: Record<string, any> | null
}
