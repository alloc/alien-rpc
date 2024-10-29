// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const test = route.get("/test", async (): Promise<Response> => {
  return new Response("Hello, world!");
});

/**
 * client/api.ts
 */
import { RequestOptions, ResponsePromise, RpcRoute } from "@alien-rpc/client";

export const test: RpcRoute<
  "test",
  (requestOptions?: RequestOptions) => ResponsePromise
> = { path: "test", method: "GET", arity: 1, format: "response" } as any;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/test",
    method: "GET",
    import: async () => (await import("../routes.js")).test,
    format: "response",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Any(),
  },
] as const;
