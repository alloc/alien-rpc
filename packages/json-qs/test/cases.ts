import { CodableObject } from '../src/types.js'

type Case = { decoded: CodableObject; encoded: string }

export const cases: Record<string, Case | Case[]> = {
  'nested objects': {
    decoded: { a: { b: 0 } },
    encoded: 'a={b:0}',
  },
  'multiple properties at root level': {
    decoded: { a: 0, b: 1 },
    encoded: 'a=0&b=1',
  },
  'multiple properties in nested object': {
    decoded: { a: { b: 1, c: 2 } },
    encoded: 'a={b:1,c:2}',
  },
  'empty property name': [
    {
      decoded: { '': 1 },
      encoded: '=1',
    },
    {
      decoded: { a: { '': 1 } },
      encoded: 'a={:1}',
    },
  ],
  'percent-encoded property names in root object': [
    {
      decoded: { 'foo&bar': 1 },
      encoded: 'foo%26bar=1',
    },
    {
      decoded: { 'foo%bar': 1 },
      encoded: 'foo%25bar=1',
    },
    {
      decoded: { "':(),~=": 1 },
      encoded: "'%3A()%2C~%3D=1",
    },
  ],
  'special property names in nested object': [
    {
      decoded: { a: { '&#%+': 1 } },
      encoded: 'a={%26%23%25%2B:1}',
    },
    {
      decoded: { a: { ':(),': 1 } },
      encoded: 'a={\\:\\(\\)\\,:1}',
    },
    {
      decoded: { a: { '\\': 1 } },
      encoded: 'a={\\\\:1}',
    },
    {
      decoded: { a: { '-1': -1, '0': 0 } },
      encoded: 'a={-1:-1,0:0}',
    },
  ],
  'empty string': [
    {
      decoded: { a: '' },
      encoded: 'a=',
    },
    {
      decoded: { a: { b: '' } },
      encoded: 'a={b:,}',
    },
    {
      decoded: { a: { '': '' } },
      encoded: 'a={:,}',
    },
    {
      decoded: { a: [''] },
      encoded: 'a=(,)',
    },
  ],
  'strings equal to constants': [
    {
      decoded: { a: 'true' },
      encoded: 'a=\\true',
    },
    {
      decoded: { a: 'false' },
      encoded: 'a=\\false',
    },
    {
      decoded: { a: 'null' },
      encoded: 'a=\\null',
    },
    {
      decoded: { a: 'NaN' },
      encoded: 'a=NaN', // NaN not supported, so not escaped
    },
    {
      decoded: { a: 'Infinity' },
      encoded: 'a=Infinity', // Infinity not supported, so not escaped
    },
  ],
  'strings with special characters': [
    {
      decoded: { a: 'foo bar' },
      encoded: 'a=foo+bar',
    },
    {
      decoded: { a: 'foo#bar' },
      encoded: 'a=foo%23bar',
    },
    {
      decoded: { a: 'foo&bar' },
      encoded: 'a=foo%26bar',
    },
    {
      decoded: { a: 'foo%bar' },
      encoded: 'a=foo%25bar',
    },
    {
      decoded: { a: 'foo+bar' },
      encoded: 'a=foo%2Bbar',
    },
    {
      decoded: { a: { '+%&': '+%&' } },
      encoded: 'a={%2B%25%26:%2B%25%26}',
    },
  ],
  'strings with reserved characters': [
    {
      decoded: { a: '123' },
      encoded: 'a=\\123',
    },
    {
      decoded: { a: '-123' },
      encoded: 'a=\\-123',
    },
    {
      decoded: { a: '\\' },
      encoded: 'a=\\\\',
    },
    {
      decoded: { a: ' (){}:, ' },
      encoded: 'a=+\\(\\)\\{\\}\\:\\,+',
    },
  ],
  'non-ASCII characters': [
    {
      decoded: { a: '💩' },
      encoded: 'a=💩',
    },
    {
      decoded: { a: 'áéíóú' },
      encoded: 'a=áéíóú',
    },
    {
      decoded: { a: '你好' },
      encoded: 'a=你好',
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
  'object in array': [
    {
      decoded: { a: [{ b: 0 }] },
      encoded: 'a=({b:0})',
    },
    {
      decoded: { a: [{ b: 0 }, { c: 1 }] },
      encoded: 'a=({b:0},{c:1})',
    },
    {
      decoded: { a: [{ b: [{ c: 1 }] }] },
      encoded: 'a=({b:({c:1})})',
    },
  ],
  'empty arrays': {
    decoded: { a: [] },
    encoded: 'a=()',
  },
  'empty objects': {
    decoded: { a: {} },
    encoded: 'a={}',
  },
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
      decoded: { num: 1e100 },
      encoded: 'num=1e100',
    },
    {
      decoded: { num: 1e-100 },
      encoded: 'num=1e-100',
    },
    {
      decoded: { num: 0 },
      encoded: 'num=0',
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
        scores: [100, 95],
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
      metadata: null,
    },
    encoded:
      "metadata=null&user={name:John's+%26+Jane's,preferences:{notifications:true,theme:dark},scores:(100,95)}",
  },
}
