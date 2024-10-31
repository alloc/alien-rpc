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

export const getPost = route.get(
  "/posts/:id",
  async ({ id }): Promise<Post> => {
    return {
      id,
      title: "Hello World",
      body: "This is a post",
      author: {
        id: "1",
        name: "John Doe",
      },
    };
  },
);

/**
 * client/generated/api.ts
 */
import { RequestOptions, RequestParams, Route } from "@alien-rpc/client";

export const getPost: Route<
  "posts/:id",
  (
    params: RequestParams<{ id: string }, Record<string, never>>,
    requestOptions?: RequestOptions,
  ) => Promise<{
    id: string;
    title: string;
    body: string;
    author: { id: string; name: string };
  }>
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
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/posts/:id",
    method: "GET",
    pathParams: ["id"],
    import: async () => (await import("../../routes.js")).getPost as any,
    format: "json",
    requestSchema: Type.Record(Type.String(), Type.Never()),
    responseSchema: Type.Object({
      id: Type.String(),
      title: Type.String(),
      body: Type.String(),
      author: Type.Object({
        id: Type.String(),
        name: Type.String(),
      }),
    }),
  },
] as const;
