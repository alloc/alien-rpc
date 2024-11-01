// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const voidTest = route.post("/void", async () => {});

/**
 * client/generated/api.ts
 */
import { RequestOptions, Route } from "@alien-rpc/client";

export const voidTest: Route<
  "void",
  (requestOptions?: RequestOptions) => Promise<undefined>
> = { path: "void", method: "POST", arity: 1, format: "json" } as any;

/**
 * server/generated/api.ts
 */
import * as Type from "@sinclair/typebox/type";

export default [
  {
    path: "/void",
    method: "POST",
    import: async () => (await import("../../routes.js")).voidTest as any,
    format: "json",
    responseSchema: Type.Undefined(),
  },
] as const;
