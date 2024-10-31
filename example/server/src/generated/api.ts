import { Type } from "@sinclair/typebox"
import { NumberParam } from "@alien-rpc/service/typebox"

export default [{path: "/v1/posts", method: "POST", import: async () => (await import("../api/post.ts")).createPost as any, format: "json", requestSchema: Type.Object({
title: Type.String(),
content: Type.String()
}), responseSchema: Type.Undefined()}, {path: "/v1/user/:userId/posts", method: "GET", pathParams: ["userId"], import: async () => (await import("../api/post.ts")).streamPostsByUser as any, format: "json-seq", requestSchema: Type.Object({
page: Type.Optional(Type.Number({ minimum: 1 })),
limit: Type.Optional(Type.Number({ maximum: 25 }))
}), responseSchema: Type.AsyncIterator(Type.Object({
id: Type.Number(),
user_slug: Type.String(),
title: Type.String(),
content: Type.String(),
created_at: Type.String()
}))}, {path: "/v1/timeline", method: "GET", import: async () => (await import("../api/post.ts")).streamTimeline as any, format: "json-seq", pathSchema: Type.Object({
page: Type.Optional(NumberParam({ minimum: 1 })),
limit: Type.Optional(NumberParam({ maximum: 100 }))
}), requestSchema: Type.Record(Type.String(), Type.Never()), responseSchema: Type.AsyncIterator(Type.Intersect([
Type.Object({
id: Type.Number(),
user_slug: Type.String(),
title: Type.String(),
content: Type.String(),
created_at: Type.String()
}),
Type.Object({
user_name: Type.String()
})
]))}, {path: "/v1/users", method: "POST", import: async () => (await import("../api/user.ts")).signUp as any, format: "json", requestSchema: Type.Union([
Type.Object({},
{
additionalProperties: Type.Union([
Type.Null(),
Type.String(),
Type.Number(),
Type.Literal(false),
Type.Literal(true),
Type.Object({},
{
additionalProperties: Type.Union([
JSONCodable,
Type.Undefined()
])
 }),
Type.Object({
toJSON: Type.Function([], JSONCodable)
}),
Type.Array(Type.Union([
Type.Null(),
Type.String(),
Type.Number(),
Type.Literal(false),
Type.Literal(true),
Type.Object({},
{
additionalProperties: Type.Union([
JSONCodable,
Type.Undefined()
])
 }),
Type.Object({
toJSON: Type.Function([], JSONCodable)
}),
Type.Readonly(Type.Array(JSONCodable))
]))
])
 }),
Type.Object({
toJSON: Type.Function([], JSONObjectCodable)
})
]), responseSchema: Type.Object({
avatarUrl: Type.String(),
slug: Type.String(),
publishKey: Type.String()
})}] as const