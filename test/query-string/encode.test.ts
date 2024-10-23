import { encode } from '../../packages/client/src/query-string/encode'

describe('alien-query-string', () => {
  test('encodes nested objects', () => {
    expect(encode({ a: { b: 0 } })).toBe('a=(b=0)')
  })

  test('encodes multiple properties at root level', () => {
    expect(encode({ a: 0, b: 1 })).toBe('a=0&b=1')
  })

  test('encodes multiple properties in nested object', () => {
    expect(encode({ a: { b: 1, c: 2 } })).toBe('a=(b=1,c=2)')
  })

  test('encodes strings with special characters', () => {
    expect(encode({ a: '(b=0)' })).toBe("a='(b=0)'")
    expect(encode({ a: "foo'bar" })).toBe("a='foo''bar'")
    expect(encode({ a: 'foo bar' })).toBe("a='foo+bar'")
    expect(encode({ a: 'foo&bar' })).toBe("a='foo%26bar'")
    expect(encode({ a: 'foo%bar' })).toBe("a='foo%25bar'")
    expect(encode({ a: 'foo+bar' })).toBe("a='foo%2Bbar'")
  })

  test('encodes non-ASCII characters', () => {
    expect(encode({ a: '💩' })).toBe("a='%F0%9F%92%A9'")
    expect(encode({ a: 'áéíóú' })).toBe("a='%C3%A1%C3%A9%C3%AD%C3%B3%C3%BA'")
    expect(encode({ a: '你好' })).toBe("a='%E4%BD%A0%E5%A5%BD'")
  })

  test('encodes arrays', () => {
    expect(encode({ a: [0, 1] })).toBe('a=(0,1)')
    expect(encode({ a: ['foo', 'bar'] })).toBe("a=('foo','bar')")
    expect(encode({ a: [0, [1, 2], 3] })).toBe('a=(0,(1,2),3)')
    expect(encode({ a: [{ b: 1 }, { c: 2 }] })).toBe('a=((b=1),(c=2))')
  })

  test('encodes sparse arrays', () => {
    expect(encode({ a: [0, , 2] })).toBe('a=(0,,2)')
  })

  test('encodes empty arrays', () => {
    expect(encode({ a: [] })).toBe('a=()')
  })

  test('encodes empty objects', () => {
    expect(encode({})).toBe('')
    expect(encode({ a: {} })).toBe('a=(=)')
  })

  test('handles undefined values', () => {
    expect(encode({ a: undefined })).toBe('')
    expect(encode({ a: [0, undefined, 1] })).toBe('a=(0,,1)')
    expect(encode({ a: { b: undefined, c: 1 } })).toBe('a=(c=1)')
  })

  test('encodes booleans', () => {
    expect(encode({ bool: true })).toBe('bool=true')
    expect(encode({ bool: false })).toBe('bool=false')
  })

  test('encodes numbers', () => {
    expect(encode({ num: 42 })).toBe('num=42')
    expect(encode({ num: 42.5 })).toBe('num=42.5')
    expect(encode({ num: -42.5 })).toBe('num=-42.5')
    expect(encode({ num: 0 })).toBe('num=0')
    expect(encode({ num: -0 })).toBe('num=0')
    expect(encode({ num: NaN })).toBe('num=NaN')
    expect(encode({ num: Infinity })).toBe('num=Infinity')
    expect(encode({ num: -Infinity })).toBe('num=-Infinity')
  })

  test('encodes bigints', () => {
    expect(encode({ bigint: 9007199254740991n })).toBe(
      'bigint=9007199254740991n'
    )
  })

  test('encodes null', () => {
    expect(encode({ null: null })).toBe('null=null')
  })

  test('encodes complex nested structures', () => {
    const complex = {
      user: {
        name: "John's & Jane's",
        scores: [100, undefined, 95],
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
      metadata: null,
    }
    expect(encode(complex)).toBe(
      "user=(name='John''s %26 Jane''s',scores=(100,,95),preferences=(theme='dark',notifications=true))&metadata=null"
    )
  })

  test('handles special property names', () => {
    expect(encode({ 'foo&bar': 1 })).toBe('foo%26bar=1')
    expect(encode({ 'foo%bar': 1 })).toBe('foo%25bar=1')
    expect(encode({ 'foo=bar': 1 })).toBe('foo%3Dbar=1')
  })
})
