/**
 * The kitchen sink includes all possible routes that the client should
 * support.
 *
 *   - A route with a complex query parameter (whose value can be an object
 *     or array)
 *   - A route with a JSON request body
 *   - A route that returns a raw Response object
 *   - A route that throws an error
 *   - A route that streams continuously (via async generator)
 *   - A route that returns a paginated result
 */
import { paginate, route } from '@alien-rpc/service'
import { sleep } from 'radashi'

/**
 * A route that takes no parameters
 */
export const getOne = route.get('/one', () => 1)

/**
 * A route that takes a single parameter
 */
export const getPostById = route.get('/post/:id', ({ id }) => id)

/**
 * A route with an optional search parameter
 */
export const getAllPosts = route.get(
  '/posts',
  ({}, { limit }: { limit?: number }) =>
    Array.from({ length: limit ?? 5 }, (_, i) => i)
)

/**
 * A route with a complex search parameter
 */
export const getLength = route.get(
  '/length',
  ({}, { val }: { val: unknown[] | string | { length: number } }) => val.length
)

/**
 * A route that returns a paginated result
 */
export const streamPosts = route.get(
  '/posts/stream',
  async function* ({}, { offset = 0 }: { offset?: number }) {
    yield 1 + offset
    await sleep(5)

    yield 2 + offset
    await sleep(5)

    return paginate(this, {
      next: { offset: offset + 2 },
      prev: offset > 0 ? { offset: offset - 2 } : null,
    })
  }
)
