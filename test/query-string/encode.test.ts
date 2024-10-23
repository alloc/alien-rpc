import { castArray } from 'radashi'
import { encode } from '../../packages/client/src/query-string/encode'
import { spec } from './spec'

describe('alien-query-string', () => {
  describe('encode', () => {
    for (const name in spec) {
      test(name, () => {
        for (const { decoded, encoded } of castArray(spec[name])) {
          expect(encode(decoded)).toBe(encoded)
        }
      })
    }

    test('negative zero (not preserved)', () => {
      expect(encode({ a: -0 })).toBe('a=0')
    })

    test('properties are sorted in ascending alphanumeric order', () => {
      expect(encode({ b: { d: 3, c: 2 }, a: 1, '0': 0 })).toBe(
        '0=0&a=1&b=(c=2,d=3)'
      )
    })
  })
})
