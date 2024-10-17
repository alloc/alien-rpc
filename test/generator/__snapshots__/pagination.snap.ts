// @ts-nocheck

/**
 * routes.ts
 */
import { route, paginate } from "@alien-rpc/service";

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

export const paginatedNumbers = route.get(
  "/posts",
  async function* (
    {},
    { page = 1, limit = 10 }: { page?: number; limit?: number },
  ) {
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
 * client/api.ts
 */
import {
  RequestOptions,
  RequestParams,
  ResponseStream,
  RpcRoute,
} from "@alien-rpc/client";
import jsonSeq from "@alien-rpc/client/formats/json-seq";

export const paginatedNumbers = {
  path: "posts",
  method: "get",
  jsonParams: [],
  arity: 2,
  format: jsonSeq,
} as RpcRoute<
  "posts",
  (
    params: RequestParams<
      Record<string, never>,
      { page?: number; limit?: number | undefined }
    >,
    requestOptions?: RequestOptions,
  ) => ResponseStream<{ id: number; title: string; content: string }>
>;

/**
 * server/api.ts
 */
import { Type } from "@sinclair/typebox";

export default [
  {
    path: "/posts",
    method: "get",
    jsonParams: [],
    import: async () => (await import("../routes.js")).paginatedNumbers,
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
