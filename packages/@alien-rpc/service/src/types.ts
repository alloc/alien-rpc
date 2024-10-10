import type { RpcResponseFormat } from '@alien-rpc/client'
import { RequestContext } from '@hattip/compose'
import { TObject, TSchema } from '@sinclair/typebox'
import { ValidResult } from './route'

export interface RouteContext extends RequestContext {
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

export type RouteMethod = 'get' | 'post'

export type Promisable<T> = T | Promise<T>

type JSON = { [key: string]: JSON } | readonly JSON[] | JSONValue
type JSONValue = string | number | boolean | null | undefined

export type ValidIterator = AsyncIterator<JSON>
export type ValidResult = Promisable<JSON | Response | ValidIterator>

/**
 * An internal route definition.
 */
export interface RouteDefinition {
  method: RouteMethod
  path: string
  format: RpcResponseFormat
  handler: (
    pathParams: object,
    data: object,
    context: RouteContext
  ) => ValidResult
  requestSchema: TObject
  responseSchema: TSchema
}
