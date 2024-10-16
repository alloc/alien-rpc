// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

/**
 * Get "foo" from the server.
 *
 * @returns "foo"
 * @see https://en.wikipedia.org/wiki/Foo_(disambiguation)
 */
export const foo = route.get("/foo", () => {
  return "foo";
});

/**
 * client/api.ts
 */
import { RequestOptions, RpcRoute } from "@alien-rpc/client";

/**
 * Get "foo" from the server.
 *
 * @returns "foo"
 * @see https://en.wikipedia.org/wiki/Foo_(disambiguation)
 */
export const foo = {
  path: "foo",
  method: "get",
  jsonParams: [],
  arity: 1,
  format: "json",
} as RpcRoute<"foo", (requestOptions?: RequestOptions) => Promise<"foo">>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/foo",
    method: "get",
    jsonParams: [],
    import: async () => (await import("../routes.js")).foo.handler,
    format: "json",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Literal("foo"),
  },
] as const;
