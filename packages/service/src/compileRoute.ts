import { bodylessMethods } from '@alien-rpc/route'
import { RequestContext } from '@hattip/compose'
import * as jsonQS from '@json-qs/json-qs'
import { KindGuard, Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
  TransformDecodeCheckError,
  ValueErrorType,
} from '@sinclair/typebox/value'
import { supportedResponders } from './responders/index.js'
import { Route, RouteHandler } from './types.js'

export type CompiledRoute = ReturnType<typeof compileRoute>

export function compileRoute(route: Route) {
  const decodePathData = compilePathSchema(route)
  const decodeRequestData = compileRequestSchema(route)
  const responder = supportedResponders[route.format](route)

  async function getHandlerArgs(
    params: {},
    ctx: RequestContext
  ): Promise<Parameters<RouteHandler>> {
    const data = await decodeRequestData(ctx)

    if (route.pathParams) {
      params = decodePathData(params)

      if (route.pathParams.length > 1) {
        return [Object.values(params), data, ctx]
      }

      return [params[route.pathParams[0] as keyof typeof params], data, ctx]
    }

    return [data, ctx]
  }

  return {
    method: route.method,
    path: route.path,
    /**
     * Parse and validate the request, returning an array of arguments to
     * call the route handler with.
     */
    getHandlerArgs,
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
      const args = await getHandlerArgs(params, ctx)
      return responder(args, ctx)
    },
  }
}

function compilePathSchema(
  route: Route
): <TParams extends {}>(params: TParams) => TParams {
  if (route.pathSchema) {
    const pathSchema = TypeCompiler.Compile(route.pathSchema)
    return params => pathSchema.Decode(params)
  }
  return params => params
}

function compileRequestSchema(
  route: Route
): (ctx: RequestContext) => Promise<unknown> {
  if (!route.requestSchema) {
    return async () => null
  }

  const requestSchema = TypeCompiler.Compile(route.requestSchema)

  if (!bodylessMethods.has(route.method)) {
    return async ({ request }) =>
      requestSchema.Decode(
        request.headers.get('Content-Type') === 'application/json'
          ? await request.json()
          : {}
      )
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
