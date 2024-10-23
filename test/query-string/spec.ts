type CodableValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | CodableObject
  | readonly CodableValue[]

type CodableObject = { [key: string]: CodableValue }

type Case = {
  decoded: CodableObject
  encoded: string
}

export const spec: Record<string, Case | Case[]> = {
  'nested objects': {
    decoded: { a: { b: 0 } },
    encoded: 'a=(b=0)',
  },
  'multiple properties at root level': {
    decoded: { a: 0, b: 1 },
    encoded: 'a=0&b=1',
  },
  'multiple properties in nested object': {
    decoded: { a: { b: 1, c: 2 } },
    encoded: 'a=(b=1,c=2)',
  },
  'special property names at root level': [
    {
      decoded: { 'foo&bar': 1 },
      encoded: 'foo%26bar=1',
    },
    {
      decoded: { 'foo%bar': 1 },
      encoded: 'foo%25bar=1',
    },
    {
      decoded: { 'foo=bar': 1 },
      encoded: 'foo%3Dbar=1',
    },
  ],
  'special property names in nested object': {
    decoded: { a: { '@#$&': 1 } },
    encoded: 'a=(%40%23%24%26=1)',
  },
  'strings with special characters': [
    {
      decoded: { a: '(b=0)' },
      encoded: "a='(b=0)'",
    },
    {
      decoded: { a: "foo'bar" },
      encoded: "a='foo''bar'",
    },
    {
      decoded: { a: 'foo bar' },
      encoded: "a='foo+bar'",
    },
    {
      decoded: { a: 'foo&bar' },
      encoded: "a='foo%26bar'",
    },
    {
      decoded: { a: 'foo%bar' },
      encoded: "a='foo%25bar'",
    },
    {
      decoded: { a: 'foo+bar' },
      encoded: "a='foo%2Bbar'",
    },
  ],
  'non-ASCII characters': [
    {
      decoded: { a: '💩' },
      encoded: "a='%F0%9F%92%A9'",
    },
    {
      decoded: { a: 'áéíóú' },
      encoded: "a='%C3%A1%C3%A9%C3%AD%C3%B3%C3%BA'",
    },
    {
      decoded: { a: '你好' },
      encoded: "a='%E4%BD%A0%E5%A5%BD'",
    },
  ],
  arrays: {
    decoded: { a: [0, 1] },
    encoded: 'a=(0,1)',
  },
  'nested arrays': {
    decoded: {
      a: [
        [0, 1],
        [2, 3],
      ],
    },
    encoded: 'a=((0,1),(2,3))',
  },
  'sparse arrays': {
    decoded: { a: [0, , 2] },
    encoded: 'a=(0,,2)',
  },
  'empty arrays': {
    decoded: { a: [] },
    encoded: 'a=()',
  },
  'empty objects': {
    decoded: { a: {} },
    encoded: 'a=(=)',
  },
  'undefined values': [
    {
      decoded: { a: undefined },
      encoded: '',
    },
    {
      decoded: { a: [0, undefined, 1] },
      encoded: 'a=(0,,1)',
    },
    {
      decoded: { a: { b: undefined, c: 1 } },
      encoded: 'a=(c=1)',
    },
  ],
  booleans: [
    {
      decoded: { true: true },
      encoded: 'true=true',
    },
    {
      decoded: { false: false },
      encoded: 'false=false',
    },
  ],
  numbers: [
    {
      decoded: { num: 42 },
      encoded: 'num=42',
    },
    {
      decoded: { num: 42.5 },
      encoded: 'num=42.5',
    },
    {
      decoded: { num: -42.5 },
      encoded: 'num=-42.5',
    },
    {
      decoded: { num: 0 },
      encoded: 'num=0',
    },
    {
      decoded: { num: NaN },
      encoded: 'num=NaN',
    },
    {
      decoded: { num: Infinity },
      encoded: 'num=Infinity',
    },
    {
      decoded: { num: -Infinity },
      encoded: 'num=-Infinity',
    },
  ],
  bigints: {
    decoded: { bigint: 9007199254740992n },
    encoded: 'bigint=9007199254740992n',
  },
  null: {
    decoded: { null: null },
    encoded: 'null=null',
  },
  'complex nested structures': {
    decoded: {
      user: {
        name: "John's & Jane's",
        scores: [100, undefined, 95],
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
      metadata: null,
    },
    encoded:
      "metadata=null&user=(name='John''s+%26+Jane''s',preferences=(notifications=true,theme='dark'),scores=(100,,95))",
  },
}
