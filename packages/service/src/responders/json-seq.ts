import { RequestContext } from '@hattip/compose'
import { TAsyncIterator } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { isPromise } from 'node:util/types'
import { JSON, Promisable } from '../internal/types'
import { resolvePaginationLink } from '../pagination'
import { Route, RouteIterator, RouteResponder } from '../types'

const responder: RouteResponder<Promisable<RouteIterator>> =
  (handler, route) => async (params, data, ctx) => {
    let result = handler(params, data, ctx)
    if (isPromise(result)) {
      result = await result
    }

    result = Value.Encode(route.responseSchema, result) as RouteIterator

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
  ctx: RequestContext
) {
  const yieldSchema = (route.responseSchema as TAsyncIterator).items
  const encoder = new TextEncoder()

  while (true) {
    const iteration = await iterator.next()

    let value: JSON
    if (iteration.done) {
      const links = iteration.value
      if (!links) {
        return
      }

      value = {
        $prev: links.prev ? resolvePaginationLink(ctx.url, links.prev) : null,
        $next: links.next ? resolvePaginationLink(ctx.url, links.next) : null,
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
}
