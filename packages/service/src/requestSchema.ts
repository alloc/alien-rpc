import { juri } from '@alien-rpc/juri'
import { KindGuard, TSchema, Type } from '@alien-rpc/typebox'
import { SchemaOptions, TUnion } from '@sinclair/typebox/type'
import { Value } from '@sinclair/typebox/value'
import { isString, pick } from 'radashi'
import { Route } from './types'

export function transformRequestSchema(route: Route) {
  if (route.method !== 'get') {
    // JSON request body doesn't need custom handling.
    return route.requestSchema
  }
  const properties = Object.entries(route.requestSchema.properties)
  if (properties.length === 0) {
    return route.requestSchema
  }
  return Type.Object(
    Object.fromEntries(
      properties.map(entry => {
        const type = entry[1]
        entry[1] = transformQueryParameter(type) || type
        return entry
      })
    ) as Type.TJsonProperties,
    extractSchemaOptions(route.requestSchema)
  )
}

function transformQueryParameter(type: TSchema): TSchema | undefined {
  // Raw strings are URL encoded.
  if (KindGuard.IsString(type)) {
    return
  }

  if (KindGuard.IsUnion(type)) {
    // Raw strings are URL encoded.
    if (unionEvery(type, KindGuard.IsString)) {
      return
    }

    return Type.Union(
      type.anyOf.map(
        variant =>
          transformQueryParameter(variant) ||
          // When a string type is wrapped in a union with non-string
          // types, it must be JSON encoded.
          JsonTransform(variant)
      ),
      extractSchemaOptions(type)
    )
  }

  if (isJuriEncoded(type)) {
    return JuriObjectTransform(type)
  }

  // Root-level primitives are JSON encoded. Even though JSON is less
  // compact than JURI encoding, it's more human-readable and faster.
  return JsonTransform(type)
}

function JuriObjectTransform(schema: TSchema) {
  return Type.Transform(Type.String({ pattern: '^\\(' }))
    .Decode(value => {
      return Value.Decode(schema, juri.decode(value))
    })
    .Encode(value => {
      return juri.encode(Value.Encode(schema, value))
    })
}

function JsonTransform(schema: TSchema) {
  return Type.Transform(Type.String(extractSchemaOptions(schema)))
    .Decode(value => {
      return Value.Decode(schema, JSON.parse(value))
    })
    .Encode(value => {
      return JSON.stringify(Value.Encode(schema, value))
    })
}

/**
 * Objects and arrays are JURI encoded, which is designed to be URL-safe
 * and it aims for a balance between human-readable and compact. For
 * objects and arrays, JURI is much better than JSON, since it avoids the
 * nasty percent encoding.
 */
function isJuriEncoded(schema: TSchema) {
  return (
    isString(schema.type) &&
    (schema.type === 'object' || schema.type === 'array')
  )
}

/**
 * Recursively check each variant in a union, with support for nested
 * unions.
 */
function unionEvery(
  schema: TUnion,
  check: (schema: TSchema) => boolean
): boolean {
  return schema.anyOf.every(variant =>
    KindGuard.IsUnion(variant) ? unionEvery(variant, check) : check(variant)
  )
}

function extractSchemaOptions(schema: TSchema): SchemaOptions {
  return pick(schema, [
    '$schema',
    '$id',
    'title',
    'description',
    'default',
    'examples',
    'readOnly',
    'writeOnly',
  ])
}
