// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const voidTest = route.post("/void", async () => {});

/**
 * client/api.ts
 */
import { RequestOptions, RpcRoute } from "@alien-rpc/client";

export const voidTest: RpcRoute<
  "void",
  (requestOptions?: RequestOptions) => Promise<undefined>
> = { path: "void", method: "post", arity: 1, format: "json" } as any;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/void",
    method: "post",
    import: async () => (await import("../routes.js")).voidTest,
    format: "json",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Undefined(),
  },
] as const;
