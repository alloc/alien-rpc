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

export const getSortedPosts: RpcRoute<
  "posts",
  (
    params: RequestParams<
      Record<string, never>,
      { order: "asc" | "desc"; key: "title" | "date" }
    >,
    requestOptions?: RequestOptions,
  ) => Promise<Post[]>
> = { path: "posts", method: "GET", arity: 2, format: "json" } as any;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/posts",
    method: "GET",
    import: async () => (await import("../routes.js")).getSortedPosts,
    format: "json",
    requestSchema: Type.Object({
      order: Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
      key: Type.Union([Type.Literal("title"), Type.Literal("date")]),
    }),
    responseSchema: Type.Array(Post),
  },
] as const;
