import { RequestContext } from '@hattip/compose'
import { TObject } from '@sinclair/typebox'

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

/**
 * An internal route definition.
 */
export interface RouteDefinition {
  method: 'get' | 'post'
  path: string
  handler: (pathParams: object, data: object, context: RouteContext) => any
  requestSchema: TObject
  responseSchema: TObject
}
