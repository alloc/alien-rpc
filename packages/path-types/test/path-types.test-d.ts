import { describe, expectTypeOf, test } from 'vitest'
import { InferParams } from '../'

describe('InferParams', () => {
  test('single named parameter', () => {
    expectTypeOf<InferParams<'/:foo'>>().toEqualTypeOf<{ foo: string }>()
  })
})

describe('PathTemplate', () => {})
