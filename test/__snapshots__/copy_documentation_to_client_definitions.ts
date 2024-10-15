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
  method: "get",
  path: "/foo",
  arity: 1,
  jsonParams: [],
  format: "json",
} as RpcRoute<"/foo", (requestOptions?: RequestOptions) => Promise<"foo">>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.foo,
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Literal("foo"),
    jsonParams: [],
    format: "json",
  },
] as const;
