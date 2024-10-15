import {
  SchemaOptions,
  Static,
  TLiteral,
  TOptional,
  TSchema,
  TUnsafe,
  Type,
} from '@sinclair/typebox'

const primitiveTypes = [
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
  Type.Undefined(),
]

export const JsonPrimitive = (options?: SchemaOptions) =>
  Type.Union(primitiveTypes, options)

export const JsonValue = (options?: SchemaOptions): TUnsafe<JsonValue> =>
  Type.Recursive(JsonValue => {
    return Type.Union([
      ...primitiveTypes,
      Type.Record(Type.String(), JsonValue),
      Type.Array(JsonValue),
    ])
  }, options) as any

export const JsonObject = (options?: SchemaOptions) =>
  Type.Record(Type.String(), JsonValue(), options)

export const JsonArray = (options?: SchemaOptions) =>
  Type.Array(JsonValue(), options)

export type JsonValue =
  | Static<TJsonPrimitive>
  | Static<TJsonObject>
  | JsonValue[]

export type JsonPrimitive = Static<TJsonPrimitive>
export type JsonObject = Static<TJsonObject>
export type JsonArray = Static<TJsonArray>

export type TJsonValue =
  | TJsonPrimitive
  | TJsonObject
  | TJsonArray
  | TJsonUnion
  | TJsonUnsafe

export type TJsonPrimitive =
  | ReturnType<typeof JsonPrimitive>['anyOf'][number]
  | TLiteral

export type TJsonObject = TSchema & {
  properties: TJsonProperties
  static: { [key: string]: JsonValue }
}

export type TJsonProperties = {
  [key: string]: TJsonValue | TOptional<TJsonValue>
}

export type TJsonArray = TSchema & {
  items: TJsonValue
  static: JsonValue[]
}

export type TJsonUnion = TSchema & {
  anyOf: TJsonValue[]
  static: JsonValue
}

export type TJsonUnsafe = TSchema & {
  static: JsonValue
}
