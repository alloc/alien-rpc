import { Type } from "@sinclair/typebox"

export default [{path: "/numbers", method: "get", jsonParams: [], import: async () => (await import("../routes.js")).streamNumbers, format: "json-seq", requestSchema: Type.Record(Type.String(), Type.Never()), responseSchema: Type.AsyncIterator(Type.Union([
Type.Literal(1),
Type.Literal(2),
Type.Literal(3)
]))}] as const