// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

export const funFact = route.get("/fun-fact", () => {
  const funFacts = [
    "Bananas are berries, but strawberries aren't!",
    "A group of flamingos is called a 'flamboyance'.",
    "The shortest war in history lasted 38 minutes.",
    "Cows have best friends and get stressed when separated.",
    "The Hawaiian pizza was invented in Canada.",
  ];
  return funFacts[Math.floor(Math.random() * funFacts.length)];
});

/**
 * client/api.ts
 */
import { RequestOptions, RpcRoute } from "@alien-rpc/client";

export const funFact = {
  method: "get",
  path: "/v1/fun-fact",
  arity: 1,
  jsonParams: [],
  format: "json",
} as RpcRoute<
  "/v1/fun-fact",
  (requestOptions?: RequestOptions) => Promise<string>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.funFact,
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.String(),
    jsonParams: [],
    format: "json",
  },
] as const;
