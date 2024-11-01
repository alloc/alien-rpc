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
 * client/generated/api.ts
 */
import { RequestOptions, ResponseStream, Route } from "@alien-rpc/client";
import jsonSeq from "@alien-rpc/client/formats/json-seq";

export const streamNumbers: Route<
  "numbers",
  (requestOptions?: RequestOptions) => ResponseStream<1 | 2 | 3>
> = { path: "numbers", method: "GET", arity: 1, format: jsonSeq } as any;

/**
 * server/generated/api.ts
 */
import * as Type from "@sinclair/typebox/type";

export default [
  {
    path: "/numbers",
    method: "GET",
    import: async () => (await import("../../routes.js")).streamNumbers as any,
    format: "json-seq",
    responseSchema: Type.AsyncIterator(
      Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    ),
  },
] as const;
