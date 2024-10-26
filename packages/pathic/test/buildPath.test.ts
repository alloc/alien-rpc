import { buildPath } from '../src/buildPath'

describe('buildPath', () => {
  test('basic cases', () => {
    expect(buildPath('/', {})).toBe('/')
    expect(buildPath('/a', {})).toBe('/a')
    expect(buildPath('/a/b', {})).toBe('/a/b')

    // Colon parameters
    expect(buildPath('/a/:b', { b: 'c' })).toBe('/a/c')
    expect(buildPath('/a/:b/c', { b: 'c' })).toBe('/a/c/c')

    // Wildcard parameters
    expect(buildPath('/*', { '*': 'a' })).toBe('/a')
    expect(buildPath('/a/*b', { b: 'c' })).toBe('/a/c')
    expect(buildPath('/a/*b', { b: 'b/c' })).toBe('/a/b/c')
  })

  test('arrays', () => {
    expect(buildPath('/a/:b', { b: ['b', 'c'] })).toBe('/a/b/c')
    expect(buildPath('/a/:b/:c', { b: ['b', 'c'], c: 'd' })).toBe('/a/b/c/d')
  })

  test('missing parameters', () => {
    expect(() => buildPath('/*', {})).toThrow(
      'Missing parameter "*" in path "/*"'
    )
    expect(() => buildPath('/a/:b', {})).toThrow(
      'Missing parameter "b" in path "/a/:b"'
    )
  })
})
