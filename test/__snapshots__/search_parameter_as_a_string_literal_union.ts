// @ts-nocheck

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";

type PostSortOrder = "asc" | "desc";
type PostSortKey = "title" | "date";
type PostSort = {
  order: PostSortOrder;
  key: PostSortKey;
};

type Post = {
  id: number;
  title: string;
  content: string;
};

declare const db: {
  getPosts: (sort: PostSort) => Promise<Post[]>;
};

export const getSortedPosts = route.get("/posts", ({}, opts: PostSort) => {
  return db.getPosts(opts);
});

/**
 * client/api.ts
 */
import { RequestOptions, RequestParams, RpcRoute } from "@alien-rpc/client";

export const getSortedPosts = {
  method: "get",
  path: "/posts",
  arity: 2,
  jsonParams: [],
  format: "json",
} as RpcRoute<
  "/posts",
  (
    params: RequestParams<
      Record<string, never>,
      { order: "asc" | "desc"; key: "title" | "date" }
    >,
    requestOptions?: RequestOptions,
  ) => Promise<Post[]>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";
import * as routes from "../routes.js";

export default [
  {
    def: routes.getSortedPosts,
    requestSchema: Type.Object({
      order: Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
      key: Type.Union([Type.Literal("title"), Type.Literal("date")]),
    }),
    responseSchema: Type.Array(Post),
    jsonParams: [],
    format: "json",
  },
] as const;
