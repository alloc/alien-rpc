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

    test('NaN is encoded as null', () => {
      expect(encode({ a: NaN })).toBe('a=null')
    })

    test('Infinity is encoded as null', () => {
      expect(encode({ a: Infinity })).toBe('a=null')
      expect(encode({ a: -Infinity })).toBe('a=null')
    })

    describe('undefined values', () => {
      test('undefined in array', () => {
        expect(encode({ a: [undefined] })).toBe('a=(null)')
      })

      test('undefined in root object', () => {
        expect(encode({ a: undefined })).toBe('')
      })

      test('undefined in nested object', () => {
        expect(encode({ a: { b: undefined } })).toBe('a={}')
      })

      test('undefined property after empty string', () => {
        expect(encode({ a: { b: '', c: undefined } })).toBe('a={b:,}')
      })
    })

    test('sparse arrays', () => {
      expect(encode({ a: [0, , 2] })).toBe('a=(0,null,2)')
      expect(encode({ a: [, , ,] })).toBe('a=(null,null,null)')
    })

    test('properties are sorted in ascending alphanumeric order', () => {
      expect(encode({ b: { d: 3, c: 2 }, a: 1, '0': 0 })).toBe(
        '0=0&a=1&b={c:2,d:3}'
      )
    })
  })
})
