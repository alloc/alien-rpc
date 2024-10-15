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

export const voidTest = {
  method: "post",
  path: "/void",
  arity: 1,
  format: "json",
} as RpcRoute<"/void", (requestOptions?: RequestOptions) => Promise<undefined>>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.voidTest,
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Undefined(),
    format: "json",
  },
] as const;
