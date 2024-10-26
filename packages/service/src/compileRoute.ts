import { RequestContext } from '@hattip/compose'
import * as jsonQS from '@json-qs/json-qs'
import { KindGuard, Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
  TransformDecodeCheckError,
  ValueErrorType,
} from '@sinclair/typebox/value'
import { supportedResponders } from './responders/index.js'
import { Route, RouteMethod } from './types.js'

export type CompiledRoute = ReturnType<typeof compileRoute>

export function compileRoute(route: Route) {
  const decodeRequestData = compileRequestSchema(route)
  const responder = supportedResponders[route.format](route)

  return {
    method: route.method.toUpperCase() as Uppercase<RouteMethod>,
    path: route.path,
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

function compileRequestSchema(
  route: Route
): (ctx: RequestContext) => Promise<object> {
  const requestSchema = TypeCompiler.Compile(route.requestSchema)

  // Since non-GET requests receive a JSON request body, we can simply
  // decode it using only the request schema.
  if (route.method !== 'get') {
    return async ({ request }) => requestSchema.Decode(await request.json())
  }

  // The only supported record type is Record<string, never> which doesn't
  // need special handling.
  if (KindGuard.IsRecord(route.requestSchema)) {
    return ({ url }) =>
      requestSchema.Decode(Object.fromEntries(url.searchParams))
  }

  return ({ url }) => {
    try {
      var data = jsonQS.decode(url.searchParams)
    } catch (error: any) {
      const schema = Type.String()
      throw new TransformDecodeCheckError(schema, url.search, {
        type: ValueErrorType.String,
        message: error.message,
        errors: [],
        schema,
        path: '/',
        value: url.search,
      })
    }
    return requestSchema.Decode(data)
  }
}
