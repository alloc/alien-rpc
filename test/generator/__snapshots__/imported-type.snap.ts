// @ts-nocheck

/**
 * author.ts
 */
export type Author = {
  id: string;
  name: string;
};

/**
 * post.ts
 */
export type Post = {
  id: string;
  title: string;
  body: string;
  author: import("./author").Author;
};

/**
 * routes.ts
 */
import { route } from "@alien-rpc/service";
import type { Post } from "./post";

export const getPost = route.get("/posts/:id", async (id): Promise<Post> => {
  return {
    id,
    title: "Hello World",
    body: "This is a post",
    author: {
      id: "1",
      name: "John Doe",
    },
  };
});

/**
 * client/generated/api.ts
 */
import { RequestOptions, RequestParams, Route } from "@alien-rpc/client";

export type Author = { id: string; name: string };
export type Post = { id: string; title: string; body: string; author: Author };

export const getPost: Route<
  "posts/:id",
  (
    params: RequestParams<{ id: string }, Record<string, never>>,
    requestOptions?: RequestOptions,
  ) => Promise<Post>
> = {
  path: "posts/:id",
  method: "GET",
  pathParams: ["id"],
  arity: 2,
  format: "json",
} as any;

/**
 * server/generated/api.ts
 */
import * as Type from "@sinclair/typebox/type";

const Author = Type.Object({
  id: Type.String(),
  name: Type.String(),
});

const Post = Type.Object({
  id: Type.String(),
  title: Type.String(),
  body: Type.String(),
  author: Author,
});

export default [
  {
    path: "/posts/:id",
    method: "GET",
    pathParams: ["id"],
    import: async () => (await import("../../routes.js")).getPost as any,
    format: "json",
    responseSchema: Post,
  },
] as const;
