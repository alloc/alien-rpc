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
 * client/generated/api.ts
 */
import { RequestOptions, RequestParams, Route } from "@alien-rpc/client";

export const createUser: Route<
  "users",
  (
    params: RequestParams<Record<string, never>, { name: string }>,
    requestOptions?: RequestOptions,
  ) => Promise<number>
> = { path: "users", method: "POST", arity: 2, format: "json" } as any;

/**
 * server/generated/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/users",
    method: "POST",
    import: async () => (await import("../../routes.js")).createUser as any,
    format: "json",
    requestSchema: Type.Object({
      name: Type.String(),
    }),
    responseSchema: Type.Number(),
  },
] as const;
