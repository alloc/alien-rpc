/**
 * The kitchen sink includes all possible routes that the client should
 * support.
 *
 *   - A route that takes no parameters
 *   - A route that takes a single path parameter (which allows the client
 *     to provide the parameter value instead of wrapping it in an object
 *     first)
 *   - A route with an optional parameter
 *   - A route with a complex query parameter (whose value can be an object
 *     or array)
 *   - A route with a JSON request body
 *   - A route that returns a raw Response object
 *   - A route that throws an error
 *   - A route that streams continuously (via async generator)
 *   - A route that returns a paginated result
 */
import { route } from '@alien-rpc/service'

/**
 * A route that takes no parameters
 */
export const getOne = route.get('/one', () => 1)

/**
 * A route that takes a single parameter
 */
export const getPostById = route.get('/post/:id', ({ id }) => id)

/**
 * A route with an optional parameter
 */
export const getAllPosts = route.get(
  '/posts',
  ({}, { limit }: { limit?: number }) =>
    Array.from({ length: limit ?? 5 }, (_, i) => i)
)
