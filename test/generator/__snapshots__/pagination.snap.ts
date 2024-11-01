// @ts-nocheck

/**
 * routes.ts
 */
import { paginate, route } from "@alien-rpc/service";

type Post = {
  id: number;
  title: string;
  content: string;
};

declare const db: {
  countPosts: () => Promise<number>;
  streamPosts: (args: {
    page: number;
    limit: number;
  }) => AsyncGenerator<Post, void, unknown>;
};

export const listPosts = route.get(
  "/posts",
  async function* ({
    page = 1,
    limit = 10,
  }: {
    page?: number;
    limit?: number;
  }) {
    yield* db.streamPosts({ page, limit });

    const postCount = await db.countPosts();
    return paginate(this, {
      prev: page > 1 ? { page: page - 1, limit } : null,
      next:
        page < Math.ceil(postCount / limit) ? { page: page + 1, limit } : null,
    });
  },
);

/**
 * client/generated/api.ts
 */
import {
  RequestOptions,
  RequestParams,
  ResponseStream,
  Route,
} from "@alien-rpc/client";
import jsonSeq from "@alien-rpc/client/formats/json-seq";

export const listPosts: Route<
  "posts",
  (
    params?: RequestParams<
      Record<string, never>,
      { page?: number; limit?: number | undefined }
    > | null,
    requestOptions?: RequestOptions,
  ) => ResponseStream<{ id: number; title: string; content: string }>
> = { path: "posts", method: "GET", arity: 2, format: jsonSeq } as any;

/**
 * server/generated/api.ts
 */
import * as Type from "@sinclair/typebox/type";

export default [
  {
    path: "/posts",
    method: "GET",
    import: async () => (await import("../../routes.js")).listPosts as any,
    format: "json-seq",
    requestSchema: Type.Object({
      page: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Union([Type.Number(), Type.Undefined()])),
    }),
    responseSchema: Type.AsyncIterator(
      Type.Object({
        id: Type.Number(),
        title: Type.String(),
        content: Type.String(),
      }),
    ),
  },
] as const;
