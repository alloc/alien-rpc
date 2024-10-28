import { NumberOptions, SchemaOptions, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { pick } from 'radashi'

export function NumberString(options?: NumberOptions) {
  const numberType = Type.Number(options)

  return Type.Transform(Type.String(pickSchemaOptions(options)))
    .Decode(string => Value.Decode(numberType, Number(string)))
    .Encode(String)
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
