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
import jsonSeq from "@alien-rpc/client/formats/json-seq";

export const streamNumbers = {
  path: "numbers",
  method: "get",
  jsonParams: [],
  arity: 1,
  format: jsonSeq,
} as RpcRoute<
  "numbers",
  (requestOptions?: RequestOptions) => ResponseStream<1 | 3 | 2>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/numbers",
    method: "get",
    jsonParams: [],
    import: async () => (await import("../routes.js")).streamNumbers,
    format: "json-seq",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.AsyncIterator(
      Type.Union([Type.Literal(1), Type.Literal(3), Type.Literal(2)]),
    ),
  },
] as const;
