import type { TAsyncIterator } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { JSON } from '../internal/types'
import { resolvePaginationLink } from '../pagination'
import type { Route, RouteIterator, RouteResponder } from '../types'

const responder: RouteResponder =
  route =>
  async (args, { url, response }) => {
    const routeDef = await route.import()

    let result = await routeDef.handler.apply<any, any, any>(routeDef, args)
    result = Value.Encode(route.responseSchema, result)

    const stream = ReadableStream.from(
      generateJsonTextSequence(result, route, url)
    )

    // Don't use "application/json-seq" until it's been standardized.
    response.headers.set('Content-Type', 'text/plain; charset=utf-8')

    return new Response(stream, response)
  }

export default responder

/**
 * Convert a route iterator to a “JSON text sequence” generator.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7464
 */
async function* generateJsonTextSequence(
  iterator: RouteIterator,
  route: Route,
  url: URL
) {
  const yieldSchema = (route.responseSchema as TAsyncIterator).items
  const encoder = new TextEncoder()

  try {
    while (true) {
      const iteration = await iterator.next()

      let value: JSON
      if (iteration.done) {
        const links = iteration.value
        if (!links) {
          return
        }

        value = {
          $prev: links.prev ? resolvePaginationLink(url, links.prev) : null,
          $next: links.next ? resolvePaginationLink(url, links.next) : null,
        }
      } else {
        value = Value.Encode(yieldSchema, iteration.value)
      }

      yield encoder.encode('\u001E') // ASCII record separator
      yield encoder.encode(JSON.stringify(value))
      yield encoder.encode('\n')

      if (iteration.done) {
        return
      }
    }
  } catch (error: any) {
    // console.error(error)
    throw error
  }
}
