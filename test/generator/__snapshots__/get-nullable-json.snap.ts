// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const getUserById = route.get("/users/:id", async (id: string) => {
  if (id === "1") {
    return { id: 1, name: "John" };
  }
  return null;
});

/**
 * client/generated/api.ts
 */
import { RequestOptions, RequestParams, Route } from "@alien-rpc/client";

export const getUserById: Route<
  "users/:id",
  (
    params: RequestParams<{ id: string }, Record<string, never>>,
    requestOptions?: RequestOptions,
  ) => Promise<null | { id: number; name: string }>
> = {
  path: "users/:id",
  method: "GET",
  pathParams: ["id"],
  arity: 2,
  format: "json",
} as any;

/**
 * server/generated/api.ts
 */
import * as Type from "@sinclair/typebox/type";

export default [
  {
    path: "/users/:id",
    method: "GET",
    pathParams: ["id"],
    import: async () => (await import("../../routes.js")).getUserById as any,
    format: "json",
    responseSchema: Type.Union([
      Type.Null(),
      Type.Object({
        id: Type.Number(),
        name: Type.String(),
      }),
    ]),
  },
] as const;
