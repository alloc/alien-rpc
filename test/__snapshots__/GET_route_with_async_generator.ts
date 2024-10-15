// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const streamNumbers = route.get("/numbers", async function* () {
  yield 1;
  yield 2;
  yield 3;
});

/**
 * client/api.ts
 */
import { RequestOptions, ResponseStream, RpcRoute } from "@alien-rpc/client";

export const streamNumbers = {
  method: "get",
  path: "/numbers",
  arity: 1,
  jsonParams: [],
  format: "json-seq",
} as RpcRoute<
  "/numbers",
  (requestOptions?: RequestOptions) => ResponseStream<1 | 2 | 3>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.streamNumbers,
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.AsyncIterator(
      Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    ),
    jsonParams: [],
    format: "json-seq",
  },
] as const;
