import { Type } from "@sinclair/typebox"

export default [{path: "/posts/:id", method: "get", jsonParams: [], pathParams: ["id"], import: async () => (await import("../routes.js")).getPost, format: "json", requestSchema: Type.Record(Type.String(), Type.Never()), responseSchema: Type.Object({
id: Type.String(),
title: Type.String(),
body: Type.String(),
author: Type.Object({
id: Type.String(),
name: Type.String()
})
})}] as const