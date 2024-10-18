import { route } from '@alien-rpc/service'

/**
 * Get "foo" from the server.
 * 
 * @returns "foo"
 * @see https://en.wikipedia.org/wiki/Foo_(disambiguation)
 */
export const foo = route.get('/foo', () => {
  return 'foo'
})
