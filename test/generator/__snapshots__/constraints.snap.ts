// @ts-nocheck

/**
 * routes.ts
 */
import { route, t } from "@alien-rpc/service";

export const testConstraints = route.get(
  "/constraints/:id",
  async (
    { id }: { id: string & t.Format<"uuid"> },
    {}: {
      tuple?: string[] & t.MinItems<1> & t.MaxItems<2>;
      object?: Record<string, string> & t.MinProperties<1> & t.MaxProperties<2>;
      email?: string & t.Format<"email">;
      month?: string & t.Pattern<"^[0-9]{4}-(0[1-9]|1[0-2])$">;
      date?: Date & t.MinimumTimestamp<1704067200000>;
    },
  ) => {},
);

/**
 * client/api.ts
 */
import { RequestOptions, RequestParams, RpcRoute } from "@alien-rpc/client";

export const testConstraints: RpcRoute<
  "constraints/:id",
  (
    params: RequestParams<
      { id: string },
      {
        tuple?: string[];
        object?: Record<string, string>;
        email?: string;
        month?: string;
        date?: Date;
      }
    >,
    requestOptions?: RequestOptions,
  ) => Promise<undefined>
> = {
  path: "constraints/:id",
  method: "GET",
  pathParams: ["id"],
  arity: 2,
  format: "json",
} as any;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import {
  addStringFormat,
  EmailFormat,
  UuidFormat,
} from "@alien-rpc/service/format";

addStringFormat("email", EmailFormat);
addStringFormat("uuid", UuidFormat);

export default [
  {
    path: "/constraints/:id",
    method: "GET",
    pathParams: ["id"],
    import: async () => (await import("../routes.js")).testConstraints,
    format: "json",
    pathSchema: Type.Object({
      id: Type.String({ format: "uuid" }),
    }),
    requestSchema: Type.Object({
      tuple: Type.Optional(
        Type.Array(Type.String(), { minItems: 1, maxItems: 2 }),
      ),
      object: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          minProperties: 1,
          maxProperties: 2,
        }),
      ),
      email: Type.Optional(Type.String({ format: "email" })),
      month: Type.Optional(
        Type.String({ pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" }),
      ),
      date: Type.Optional(Type.Date({ minimumTimestamp: 1704067200000 })),
    }),
    responseSchema: Type.Undefined(),
  },
] as const;
