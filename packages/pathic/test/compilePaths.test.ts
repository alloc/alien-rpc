import { compilePaths } from '../src/compilePaths'

describe('compilePaths', () => {
  test('basic cases', () => {
    const spy = vi.fn()
    const match = compilePaths(['/', '/*', '/foo'])

    match('/', spy)
    expect(spy.mock.calls).toEqual([
      [0, {}],
      [1, {}],
    ])

    spy.mockClear()

    match('/foo', spy)
    expect(spy.mock.calls).toEqual([
      [2, {}],
      [1, {}],
    ])

    spy.mockClear()

    match('/foo/bar', spy)
    expect(spy.mock.calls).toEqual([[1, {}]])
  })

  test('advanced cases', () => {
    const spy = vi.fn()
    const match = compilePaths([
      '/a/:b',
      '/a/:b/c',
      '/a/b/:c',
      '/a/*b',
      '/a/b/*c',
    ])

    match('/a/b', spy)
    expect(spy.mock.calls).toEqual([
      [0, { b: 'b' }],
      [3, { b: 'b' }],
    ])

    spy.mockClear()

    match('/a/b/c', spy)
    expect(spy.mock.calls).toEqual([
      [2, { c: 'c' }],
      [4, { c: 'c' }],
      [1, { b: 'b' }],
      [3, { b: 'b/c' }],
    ])
  })
})
