// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const complexSearch = route.get(
  "/complex",
  (
    {},
    {
      foo,
    }: {
      foo?: string | { bar?: string } | string[];
    },
  ) => {
    return foo;
  },
);

/**
 * client/api.ts
 */
import { RequestOptions, RequestParams, RpcRoute } from "@alien-rpc/client";

export const complexSearch = {
  method: "get",
  path: "/complex",
  arity: 2,
  jsonParams: ["foo"],
  format: "json",
} as RpcRoute<
  "/complex",
  (
    params: RequestParams<
      Record<string, never>,
      { foo?: string | { bar?: string } | string[] }
    >,
    requestOptions?: RequestOptions,
  ) => Promise<undefined | string | { bar?: undefined | string } | string[]>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.complexSearch,
    requestSchema: Type.Object({
      foo: Type.Optional(
        Type.Union([
          Type.String(),
          Type.Object({
            bar: Type.Optional(Type.String()),
          }),
          Type.Array(Type.String()),
        ]),
      ),
    }),
    responseSchema: Type.Union([
      Type.Undefined(),
      Type.String(),
      Type.Object({
        bar: Type.Optional(Type.Union([Type.Undefined(), Type.String()])),
      }),
      Type.Array(Type.String()),
    ]),
    jsonParams: ["foo"],
    format: "json",
  },
] as const;
