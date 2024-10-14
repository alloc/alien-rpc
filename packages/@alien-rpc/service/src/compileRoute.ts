import { RequestContext } from '@hattip/compose'
import { Value } from '@sinclair/typebox/value'
import { match } from 'path-to-regexp'
import { transformRequestSchema } from './requestSchema.js'
import { supportedResponders } from './responders/index.js'
import { Route } from './types.js'

export function compileRoute(route: Route) {
  const requestSchema = transformRequestSchema(route)
  const decodeRequestData = async ({ request, url }: RequestContext) =>
    Value.Decode(
      requestSchema,
      route.def.method === 'get'
        ? Object.fromEntries(url.searchParams)
        : await request.json()
    )

  const responder = supportedResponders[route.format](
    route.def.handler.bind(route.def),
    route
  )

  return {
    def: route.def,
    /**
     * Match the request path against the route's path pattern.
     */
    match: match(route.def.path),
    /**
     * Decode the request data using the route's request schema.
     */
    decodeRequestData,
    /**
     * Invokes the route handler and prepares the HTTP response according
     * to the route's result format. The caller is responsible for decoding
     * the request data beforehand.
     *
     * @param params - The path parameters (possibly empty).
     * @param data - The decoded request data.
     * @param ctx - The route context.
     */
    responder,
    /**
     * Decode the request data and invoke the route responder.
     *
     * @param params - The path parameters (possibly empty).
     * @param ctx - The route context.
     */
    async handle(params: {}, ctx: RequestContext) {
      const data = await decodeRequestData(ctx)
      return responder(params, data, ctx)
    },
  }
}
