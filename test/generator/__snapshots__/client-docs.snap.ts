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
export const foo: RpcRoute<
  "foo",
  (requestOptions?: RequestOptions) => Promise<"foo">
> = { path: "foo", method: "get", arity: 1, format: "json" } as any;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/foo",
    method: "get",
    import: async () => (await import("../routes.js")).foo,
    format: "json",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Literal("foo"),
  },
] as const;
