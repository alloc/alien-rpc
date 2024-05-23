import type {
  StringOptions,
  TEnum,
  TJsonProperties,
  TSchema,
} from 'alien-rpc/typebox'
import { juri } from 'juri'
import { Type, TypeGuard } from 'typebox'
import { Hint } from 'typebox/type/symbols'
import { Value } from 'typebox/value'

export function transformGetParams(params: TSchema): TSchema {
  if (TypeGuard.IsUnion(params)) {
    // Support nullable objects.
    return Type.Union(
      params.anyOf.map(param =>
        TypeGuard.IsObject(param) ? transformGetParams(param) : param
      )
    )
  }
  return Type.Object(
    Object.fromEntries(
      Object.entries<TSchema>(params.properties).map(([name, param]) => {
        return [name, transformGetParam(param) || param]
      })
    ) as TJsonProperties,
    params
  )
}

function IsEnum(param: TSchema): param is TEnum {
  return TypeGuard.IsUnion(param) && param[Hint] === 'Enum'
}

/**
 * Transform a GET parameter schema to a schema that can be used to decode and
 * encode the parameter from and to a query string.
 */
function transformGetParam(param: TSchema): TSchema | undefined {
  // Raw strings are URL encoded.
  if (TypeGuard.IsString(param)) {
    return
  }
  if (IsEnum(param) && param.anyOf.every(type => type.type === 'string')) {
    return
  }

  if (TypeGuard.IsUnion(param)) {
    return Type.Union(
      param.anyOf.flatMap(
        // When a string is in a union, it has to be JSON-encoded, whereas
        // normally URL encoding is enough.
        schema => {
          schema = transformGetParam(schema) || JsonTransform(schema)
          if (TypeGuard.IsUnion(schema)) {
            return schema.anyOf
          }
          return schema
        }
      )
    )
  }

  let encodedParam: TSchema

  // Objects and arrays are JURI encoded, which is designed to be URL-safe and
  // it aims for a balance between human-readable and compact. For objects and
  // arrays, JURI is much better than JSON, since it avoids the nasty percent
  // encoding. I thought of using JSON->URL encoding (https://jsonurl.org/), but
  // its library is bulky.
  if (TypeGuard.IsObject(param) || TypeGuard.IsArray(param)) {
    encodedParam = JuriObjectTransform(param)
  } else {
    // Everything else is JSON encoded. Even though JSON is less compact than
    // JURI encoding, it's more human-readable and probably faster.
    encodedParam = JsonTransform(param)
  }

  if (Value.Check(param, null)) {
    encodedParam = Type.Union([encodedParam, Type.Null()])
  }

  if (TypeGuard.IsOptional(param)) {
    return Type.Optional(encodedParam)
  }

  return encodedParam
}

function JuriObjectTransform(param: TSchema) {
  return Type.Transform(Type.String({ pattern: '^\\(' }))
    .Decode(value => {
      return Value.Decode(param, juri.decode(value))
    })
    .Encode(value => {
      return juri.encode(Value.Encode(param, value))
    })
}

function JsonTransform(param: TSchema) {
  const options: StringOptions = {}
  if (TypeGuard.IsNull(param)) {
    options.pattern = '^null$'
  } else if (TypeGuard.IsNumber(param)) {
    options.pattern = '^(-?0|-?[1-9][0-9]*)$'
  } else if (TypeGuard.IsBoolean(param)) {
    options.pattern = '^(true|false)$'
  }
  return Type.Transform(Type.String(options))
    .Decode(value => {
      return Value.Decode(param, JSON.parse(value))
    })
    .Encode(value => {
      return JSON.stringify(Value.Encode(param, value))
    })
}
