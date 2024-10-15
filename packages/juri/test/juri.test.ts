import { describe, expect, test } from 'vitest'
import { juri } from '../src/juri.js'

const dict = [
  'red',
  'yellow',
  'orange',
  'blue',
  'green',
  'white',
  'Asia',
  'North America',
  'South America',
  'name',
  'continent',
  'flagColors',
  'leader',
  'title',
  'term',
  'population',
  '平',
]

const data = {
  zh: {
    name: 'China',
    continent: 'Asia',
    flagColors: ['red', 'yellow'],
    leader: { name: '习 近平-习', title: 'President', term: 137 },
    population: 1434440076830,
  },
  in: {
    name: 'India',
    continent: '',
    a: true,
    b: false,
    c: null,
    emptyArray: [],
    emptyObject: {},
    flagColors: ['orange', 'white', 'green'],
    leader: {
      name: 'Narendra\nModi.',
      undef: undefined,
      title: 'Prime Minister',
      term: 119,
    },
    population: 1.19e9,
    nan: NaN,
    infi: Infinity,
    neginf: -Infinity,
    nul: null,
  },
  array: ['asdf', [3, undefined, 4]],
}

describe('juri.js tests', () => {
  test('primitives', () => {
    // Booleans
    expect(juri.encode(true)).toBe('++')
    expect(juri.encode(false)).toBe('--')
    // Nullish
    expect(juri.encode(null)).toBe('-+')
    expect(juri.encode(undefined)).toBe('+-')
    // Numbers
    expect(juri.encode(NaN)).toBe('+!')
    expect(juri.encode(Infinity)).toBe('+*')
    expect(juri.encode(-Infinity)).toBe('-*')
    expect(juri.encode(0)).toBe('+0')
    expect(juri.encode(-0)).toBe('+0') // -0 is not different from +0
    expect(juri.encode(-1)).toBe('-1')
    // Special characters
    expect(juri.encode('')).toBe("''")
    expect(juri.encode('\n')).toBe('~1')
    // Unicode
    expect(juri.encode('😊')).toBe("'DWzDuA'")
  })

  test('encodeQString and decodeQString should work correctly', () => {
    const encoded = juri.create(dict).encodeQString(data)
    const decoded = juri.create(dict).decodeQString(encoded)

    expect(decoded).toEqual(data)
    expect(encoded).toMatchInlineSnapshot(
      `"array=(asdf,(+3,+-,+4))&in=(a:++,b:--,c:-+,c*:'',emptyArray:(),emptyObject:(:),f*:(o*,w*,g*),infi:+*,l*:(n*:Narendra~1Modi.,e*:+1t,t*:Prime_Minister),n*:India,nan:+!,neginf:-*,nul:-+,p*:+1t+7)&zh=(c*:A*,f*:(r*,y*),l*:(n*:'4vW_8@H0*~F4vW',e*:+29,t*:President),n*:China,p*:+KtxIeuU)"`
    )
  })

  test('compression ratio compared to JSON', () => {
    const encoded = juri.create(dict).encodeQString(data)
    const json = JSON.stringify(data)
    const urlEncodedJson = encodeURIComponent(json)

    expect(encoded.length).toBeLessThan(json.length)
    expect(encoded.length).toBeLessThan(urlEncodedJson.length)

    expect(encoded.length).toMatchInlineSnapshot(`280`)
    expect(json.length).toMatchInlineSnapshot(`467`)
    expect(urlEncodedJson.length).toMatchInlineSnapshot(`831`)
  })
})
