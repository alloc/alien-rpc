// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

declare const db: any;

export const createUser = route.post(
  "/users",
  async ({}, { name }: { name: string }) => {
    const id: number = await db.createUser({ name });
    return id;
  },
);

/**
 * client/api.ts
 */
import { RequestOptions, RequestParams, RpcRoute } from "@alien-rpc/client";

export const createUser = {
  path: "users",
  method: "post",
  arity: 2,
  format: "json",
} as RpcRoute<
  "users",
  (
    params: RequestParams<Record<string, never>, { name: string }>,
    requestOptions?: RequestOptions,
  ) => Promise<number>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/users",
    method: "post",
    import: async () => (await import("../routes.js")).createUser,
    format: "json",
    requestSchema: Type.Object({
      name: Type.String(),
    }),
    responseSchema: Type.Number(),
  },
] as const;
