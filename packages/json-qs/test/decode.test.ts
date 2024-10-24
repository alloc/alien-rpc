import { castArray, zipToObject } from 'radashi'
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
      const cases = ['a', 'a=', 'a=(', 'a=(::)', 'a=(b:)', "a=(b:1,':2)", 'a=b']
      const results: any[] = []
      for (const input of cases) {
        try {
          results.push(decode(new URLSearchParams(input)))
        } catch (error) {
          results.push(error)
        }
      }
      expect(zipToObject(cases, results)).toMatchInlineSnapshot(`
        {
          "a": [SyntaxError: Failed to decode value for 'a' key: Unexpected end of input],
          "a=": [SyntaxError: Failed to decode value for 'a' key: Unexpected end of input],
          "a=(": [SyntaxError: Failed to decode value for 'a' key: Unterminated input from position 1],
          "a=(::)": [SyntaxError: Failed to decode value for 'a' key: Expected ')' after ':' at position 2],
          "a=(b:)": [SyntaxError: Failed to decode value for 'a' key: Unexpected character ')' at position 3],
          "a=(b:1,':2)": [SyntaxError: Failed to decode value for 'a' key: Unexpected quote at position 5],
          "a=b": [SyntaxError: Failed to decode value for 'a' key: Unexpected character 'b' at position 0],
        }
      `)
    })
  })
})
