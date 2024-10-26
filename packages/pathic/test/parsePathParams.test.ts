import { parsePathParams } from '../src/parsePathParams.js'

describe('parsePathParams', () => {
  test('single named parameter', () => {
    expect(parsePathParams('/:foo')).toEqual(['foo'])
  })
  test('multiple named parameters', () => {
    expect(parsePathParams('/genre/:genre/book/:book')).toEqual([
      'genre',
      'book',
    ])
  })
  test('wildcard parameter', () => {
    expect(parsePathParams('/user/*')).toEqual(['*'])
    expect(parsePathParams('/user/*/edit')).toEqual(['*'])
    expect(parsePathParams('/user/*rest')).toEqual(['rest'])
    expect(parsePathParams('/user/*inner/edit')).toEqual(['inner'])
  })
})
