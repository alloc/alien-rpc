// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const getUserById = route.get("/users/:id", async ({ id }, {}) => {
  if (id === "1") {
    return { id: 1, name: "John" };
  }
  return null;
});

/**
 * client/api.ts
 */
import { RequestOptions, RequestParams, RpcRoute } from "@alien-rpc/client";

export const getUserById = {
  method: "get",
  path: "/users/:id",
  arity: 2,
  jsonParams: [],
  pathParams: ["id"],
  format: "json",
} as RpcRoute<
  "/users/:id",
  (
    params: RequestParams<{ id: string }, Record<string, never>>,
    requestOptions?: RequestOptions,
  ) => Promise<null | { id: number; name: string }>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.getUserById,
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Union([
      Type.Null(),
      Type.Object({
        id: Type.Number(),
        name: Type.String(),
      }),
    ]),
    jsonParams: [],
    pathParams: ["id"],
    format: "json",
  },
] as const;
