import { RequestOptions, RequestParams, ResponseStream, Route } from '@alien-rpc/client'
import jsonSeq from '@alien-rpc/client/formats/json-seq'

export const createPost: Route<"v1/posts", (params: RequestParams<Record<string, never>, { title: string; content: string }>, requestOptions?: RequestOptions) => Promise<undefined>> = {path: "v1/posts", method: "POST", arity: 2, format: "json"} as any

export const streamPostsByUser: Route<"v1/user/:userId/posts", (params: RequestParams<{ userId: string }, { page?: number; limit?: number }>, requestOptions?: RequestOptions) => ResponseStream<{ id: number; user_slug: string; title: string; content: string; created_at: string }>> = {path: "v1/user/:userId/posts", method: "GET", pathParams: ["userId"], arity: 2, format: jsonSeq} as any

/**
 * Get a list of all users, sorted by “most recently posted”.
 */
export const streamTimeline: Route<"v1/timeline", (params?: RequestParams<{ page?: number; limit?: number }, Record<string, never>> | null, requestOptions?: RequestOptions) => ResponseStream<{ id: number; user_slug: string; title: string; content: string; created_at: string } & { user_name: string }>> = {path: "v1/timeline", method: "GET", arity: 2, format: jsonSeq} as any

export const signUp: Route<"v1/users", (params: RequestParams<Record<string, never>, { [key: string]: null | string | number | false | true | { [key: string]: JSONCodable | undefined } | { toJSON: () => JSONCodable } | Array<null | string | number | false | true | { [key: string]: JSONCodable | undefined; } | { toJSON(): JSONCodable; } | readonly JSONCodable[]> } | { toJSON: () => JSONObjectCodable }>, requestOptions?: RequestOptions) => Promise<{ avatarUrl: string; slug: string; publishKey: string }>> = {path: "v1/users", method: "POST", arity: 2, format: "json"} as any