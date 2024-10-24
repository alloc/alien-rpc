import { castArray, zip } from 'radashi'
import { decode } from '../src/decode.js'
import { cases } from './cases.js'

describe('json-qs', () => {
  describe('decode', () => {
    for (const name in cases) {
      test(name, () => {
        for (const { decoded, encoded } of castArray(cases[name])) {
          let result: unknown
          expect(() => {
            result = decode(new URLSearchParams(encoded))
          }, encoded).not.toThrow()
          expect(result, encoded).toEqual(decoded)
        }
      })
    }

    test('throws on malformed input', () => {
      const cases = ['a=(', 'a=((', 'a=(b', 'a={b:', 'a={b}', 'a={:}', 'a=1.n']
      const results: any[] = []
      for (const input of cases) {
        try {
          results.push(decode(new URLSearchParams(input)))
        } catch (error) {
          results.push(error)
        }
      }
      expect(new Map(zip(cases, results))).toMatchInlineSnapshot(`
        Map {
          "a=(" => [SyntaxError: Failed to decode value for 'a' key: Unterminated input from position 0],
          "a=((" => [SyntaxError: Failed to decode value for 'a' key: Unterminated input from position 1],
          "a=(b" => [SyntaxError: Failed to decode value for 'a' key: Unterminated input from position 1],
          "a={b:" => [SyntaxError: Failed to decode value for 'a' key: Unterminated input from position 3],
          "a={b}" => [SyntaxError: Failed to decode value for 'a' key: Unterminated key at position 2],
          "a={:}" => [SyntaxError: Failed to decode value for 'a' key: Unexpected end of string at position 2],
          "a=1.n" => [SyntaxError: Failed to decode value for 'a' key: Cannot convert 1. to a BigInt],
        }
      `)
    })
  })
})
