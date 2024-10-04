import { TypeGuard } from '@sinclair/typebox'
import * as Type from '@sinclair/typebox/type'
import {
    SchemaOptions,
    TAny,
    TNull,
    TOptional,
    TSchema,
    TUndefined,
    TUnion,
} from '@sinclair/typebox/type'
import { TJsonProperties } from './json'

export const Options = <T extends TJsonProperties>(properties: T) =>
  Type.Partial(Type.Object(properties))

export type TOptions<T extends TJsonProperties> = ReturnType<typeof Options<T>>

export const Option = <T extends TSchema>(
  schema: T,
  options?: SchemaOptions
): TOptional<T extends TAny ? TAny : TUnion<[T, TNull, TUndefined]>> =>
  Type.Optional(
    TypeGuard.IsAny(schema)
      ? schema
      : Type.Union([schema, Type.Null(), Type.Undefined()], options)
  ) as any

export type Option<T extends TSchema> = ReturnType<typeof Option<T>>
export type TOption<T extends TSchema> = Option<T>
