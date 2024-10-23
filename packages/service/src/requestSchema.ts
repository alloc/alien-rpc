import { juri } from '@alien-rpc/juri'
import { KindGuard, TSchema, Type } from '@sinclair/typebox'
import { SchemaOptions, TUnion } from '@sinclair/typebox/type'
import {
  TransformDecodeCheckError,
  TransformEncodeCheckError,
  Value,
  ValueErrorType,
} from '@sinclair/typebox/value'
import { isString, pick } from 'radashi'
import { Route } from './types'

export function transformRequestSchema(route: Route) {
  if (route.method !== 'get') {
    // JSON request body doesn't need custom handling.
    return route.requestSchema
  }
  if (KindGuard.IsRecord(route.requestSchema)) {
    // The only supported record type is Record<string, never> which
    // doesn't need to be transformed.
    return route.requestSchema
  }
  const properties = Object.entries(route.requestSchema.properties)
  if (properties.length === 0) {
    return route.requestSchema
  }
  return Type.Object(
    Object.fromEntries(
      properties.map(entry => {
        const propertySchema = entry[1]
        entry[1] =
          preserveOptional(
            propertySchema,
            transformQueryParameter(propertySchema)
          ) || propertySchema
        return entry
      })
    ),
    extractSchemaOptions(route.requestSchema)
  )
}

function transformQueryParameter(schema: TSchema): TSchema | undefined {
  // Raw strings are URL encoded.
  if (KindGuard.IsString(schema)) {
    return
  }

  if (KindGuard.IsUnion(schema)) {
    // Raw strings are URL encoded.
    if (unionEvery(schema, KindGuard.IsString)) {
      return
    }

    return Type.Union(
      schema.anyOf.map(
        variant =>
          transformQueryParameter(variant) ||
          // When a string type is wrapped in a union with non-string
          // types, it must be JSON encoded.
          JsonTransform(variant)
      ),
      extractSchemaOptions(schema)
    )
  }

  if (isJuriEncoded(schema)) {
    return JuriObjectTransform(schema)
  }

  // Root-level primitives are JSON encoded. Even though JSON is less
  // compact than JURI encoding, it's more human-readable and faster.
  return JsonTransform(schema)
}

/**
 * If the given `schema` is an optional property, then the `newSchema` must
 * also be optional.
 */
function preserveOptional(schema: TSchema, newSchema: TSchema | undefined) {
  if (newSchema && KindGuard.IsOptional(schema)) {
    return Type.Optional(newSchema)
  }
  return newSchema
}

function JuriObjectTransform(schema: TSchema) {
  return Type.Transform(
    Type.String({
      ...extractSchemaOptions(schema),
      pattern: '^\\(',
    })
  )
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
      let parsed: unknown
      try {
        parsed = JSON.parse(value)
      } catch (error: any) {
        throw new TransformDecodeCheckError(schema, value, {
          type: ValueErrorType.String,
          message: error.message,
          errors: [],
          schema,
          path: '/',
          value,
        })
      }
      return Value.Decode(schema, parsed)
    })
    .Encode(value => {
      value = Value.Encode(schema, value)
      try {
        return JSON.stringify(value)
      } catch (error: any) {
        throw new TransformEncodeCheckError(schema, value, {
          type: ValueErrorType.String,
          message: error.message,
          errors: [],
          schema,
          path: '/',
          value,
        })
      }
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
