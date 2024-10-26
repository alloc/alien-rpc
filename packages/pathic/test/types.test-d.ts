import { InferParams, PathTemplate } from '../src/types.js'

describe('InferParams', () => {
  test('single named parameter', () => {
    expectTypeOf<InferParams<'/:foo'>>().toEqualTypeOf<{ foo: string }>()
  })
  test('multiple named parameters', () => {
    expectTypeOf<InferParams<'/genre/:genre/book/:book'>>().toEqualTypeOf<{
      genre: string
      book: string
    }>()
  })
  test('wildcard parameter', () => {
    expectTypeOf<InferParams<'/user/*'>>().toEqualTypeOf<{ '*': string }>()
    expectTypeOf<InferParams<'/user/*/edit'>>().toEqualTypeOf<{ '*': string }>()
    expectTypeOf<InferParams<'/user/*rest'>>().toEqualTypeOf<{ rest: string }>()
    expectTypeOf<InferParams<'/user/*inner/edit'>>().toEqualTypeOf<{
      inner: string
    }>()
  })
})

describe('PathTemplate', () => {
  test('single named parameter', () => {
    expectTypeOf<PathTemplate<'/:foo'>>().toEqualTypeOf<`/${string}`>()
  })
  test('multiple named parameters', () => {
    expectTypeOf<
      PathTemplate<'/genre/:genre/book/:book'>
    >().toEqualTypeOf<`/genre/${string}/book/${string}`>()
  })
  test('wildcard parameter', () => {
    expectTypeOf<PathTemplate<'/user/*'>>().toEqualTypeOf<`/user/${string}`>()
    expectTypeOf<
      PathTemplate<'/user/*/edit'>
    >().toEqualTypeOf<`/user/${string}/edit`>()
    expectTypeOf<
      PathTemplate<'/user/*rest'>
    >().toEqualTypeOf<`/user/${string}`>()
  })
})
