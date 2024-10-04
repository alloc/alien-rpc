import * as Type from '@sinclair/typebox/type'
import { TSchema } from '@sinclair/typebox/type'

export const Nullable = <T extends TSchema>(schema: T) =>
  Type.Union([schema, Type.Null()])

export type TNullable<T extends TSchema> = ReturnType<typeof Nullable<T>>
