import { castArray } from 'radashi'
import { encode } from '../src/encode.js'
import { cases } from './cases.js'

describe('json-qs', () => {
  describe('encode', () => {
    for (const name in cases) {
      test(name, () => {
        for (const { decoded, encoded } of castArray(cases[name])) {
          expect(encode(decoded)).toBe(encoded)
        }
      })
    }

    test('negative zero (not preserved)', () => {
      expect(encode({ a: -0 })).toBe('a=0')
    })

    test('properties are sorted in ascending alphanumeric order', () => {
      expect(encode({ b: { d: 3, c: 2 }, a: 1, '0': 0 })).toBe(
        '0=0&a=1&b=(c:2,d:3)'
      )
    })
  })
})
