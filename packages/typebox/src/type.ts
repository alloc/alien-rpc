import { JsonValue } from '../../service/src/typebox/json'

export * from '@sinclair/typebox/type'
export * from '../../service/src/typebox/json'
export * from './type/nullable'
export * from './type/option'

/**
 * Use this instead of the type of the same name in `@sinclair/typebox`
 * when defining API routes. This improves readability while still
 * enforcing JSON-only inputs.
 */
export const Any = JsonValue
