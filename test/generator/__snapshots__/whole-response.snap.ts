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

export const test = {
  path: "test",
  method: "get",
  jsonParams: [],
  arity: 1,
  format: "response",
} as RpcRoute<"test", (requestOptions?: RequestOptions) => ResponsePromise>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/test",
    method: "get",
    jsonParams: [],
    import: async () => (await import("../routes.js")).test.handler,
    format: "response",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Recursive((This) => This),
  },
] as const;
