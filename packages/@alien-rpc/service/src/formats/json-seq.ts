import { Value } from '@sinclair/typebox/value'
import { isPromise } from 'node:util/types'
import { Promisable } from '../internal/types'
import { resolvePaginationLink } from '../pagination'
import { Route, RouteContext, RouteIterator, RouteResponder } from '../types'

const responder: RouteResponder<Promisable<RouteIterator>> =
  (handler, route) => async (params, data, ctx) => {
    let result = handler(params, data, ctx)
    if (isPromise(result)) {
      result = await result
    }

    const stream = ReadableStream.from(
      generateJsonTextSequence(result, route, ctx)
    )

    // Don't use "application/json-seq" until it's been standardized.
    ctx.response.headers.set('Content-Type', 'text/plain; charset=utf-8')

    return new Response(stream, ctx.response)
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
  ctx: RouteContext
) {
  const encoder = new TextEncoder()
  while (true) {
    const iteration = await iterator.next()

    let encodedValue: any
    if (iteration.done) {
      const links = iteration.value
      if (!links) {
        return
      }

      encodedValue = {
        $prev: links.prev ? resolvePaginationLink(ctx.url, links.prev) : null,
        $next: links.next ? resolvePaginationLink(ctx.url, links.next) : null,
      }
    } else {
      encodedValue = Value.Encode(route.responseSchema, iteration.value)
    }

    yield encoder.encode('\u001E') // ASCII record separator
    yield encoder.encode(JSON.stringify(encodedValue))
    yield encoder.encode('\n')

    if (iteration.done) {
      return
    }
  }
}
