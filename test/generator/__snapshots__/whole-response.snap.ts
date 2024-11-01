// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const test = route.get("/test", async (): Promise<Response> => {
  return new Response("Hello, world!");
});

/**
 * client/generated/api.ts
 */
import { RequestOptions, ResponsePromise, Route } from "@alien-rpc/client";

export const test: Route<
  "test",
  (requestOptions?: RequestOptions) => ResponsePromise
> = { path: "test", method: "GET", arity: 1, format: "response" } as any;

/**
 * server/generated/api.ts
 */
import * as Type from "@sinclair/typebox/type";

export default [
  {
    path: "/test",
    method: "GET",
    import: async () => (await import("../../routes.js")).test as any,
    format: "response",
    responseSchema: Type.Any(),
  },
] as const;
