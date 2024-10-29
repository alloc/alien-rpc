import {
  ArrayOptions,
  DateOptions,
  NumberOptions,
  SchemaOptions,
  TSchema,
  Type,
} from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { pick } from 'radashi'

/**
 * Coerce a path parameter to a number.
 */
export function NumberParam(options?: NumberOptions) {
  const numberType = Type.Number(options)

  return Type.Transform(Type.String(pickSchemaOptions(options)))
    .Decode(string => Value.Decode(numberType, Number(string)))
    .Encode(String)
}

/**
 * Coerce a path parameter to an array by splitting on `/`.
 */
export function ArrayParam(schema: TSchema, options?: ArrayOptions) {
  const arrayType = Type.Array(schema, options)

  return Type.Transform(Type.String(pickSchemaOptions(options)))
    .Decode(string => Value.Decode(arrayType, string.split('/')))
    .Encode(array => array.join('/'))
}

/**
 * Coerce a string to a Date. Only used for JSON request bodies.
 */
export function DateString(options?: DateOptions) {
  const dateType = Type.Date(options)

  return Type.Transform(Type.String(pickSchemaOptions(options)))
    .Decode(string => Value.Decode(dateType, new Date(string)))
    .Encode(date => date.toISOString())
}

function pickSchemaOptions(options?: SchemaOptions) {
  return (
    options &&
    pick(options, [
      '$schema',
      '$id',
      'title',
      'description',
      'default',
      'examples',
      'readOnly',
      'writeOnly',
    ])
  )
}
