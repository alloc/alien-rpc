import { Type } from '@alien-rpc/typebox'
import { Value } from '@sinclair/typebox/value'
import { createPaginationLink } from './pagination'
import { RouteContext, RouteDefinition, ValidIterator } from './types'

/**
 * Converts an async iterator to an NDJSON stream.
 *
 * @see https://github.com/ndjson/ndjson-spec
 */
export async function* ndjson(
  iterator: ValidIterator,
  route: RouteDefinition,
  ctx: RouteContext
) {
  const encoder = new TextEncoder()
  while (true) {
    const iteration = await iterator.next()

    let encodedValue: any
    if (iteration.done) {
      const cursor = iteration.value || {}
      encodedValue = Value.Encode(Type.RpcPagination, {
        prev: cursor.prev ? createPaginationLink(ctx.url, cursor.prev) : null,
        next: cursor.next ? createPaginationLink(ctx.url, cursor.next) : null,
      })
    } else {
      encodedValue = Value.Encode(route.responseSchema, iteration.value)
    }

    yield encoder.encode(JSON.stringify(encodedValue))
    yield encoder.encode('\n')

    if (iteration.done) {
      return
    }
  }
}
