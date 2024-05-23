import * as Type from 'typebox/type'
import { TSchema } from 'typebox/type'

export const Nullable = <T extends TSchema>(schema: T) =>
  Type.Union([schema, Type.Null()])

export type TNullable<T extends TSchema> = ReturnType<typeof Nullable<T>>
