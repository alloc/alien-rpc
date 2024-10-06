import { RpcEndpoint, TReturnValue } from 'alien-rpc'
import { JsonValue, TSchema, Type, Value } from 'alien-rpc/typebox'
import { match } from 'path-to-regexp'
import { transformGetParams } from '../get'
import { RpcContext, RpcPaginationResult } from './function'

export function toArray(value: any): any[] {
  return Array.isArray(value) ? value : [value]
}

export type Endpoint = ReturnType<typeof compileEndpoints>[number]

export function compileEndpoints(API: any) {
  type Endpoint = RpcEndpoint<string, TSchema[], TReturnValue>
  return Object.entries<Endpoint>(API).map(([name, endpoint]) => {
    const { method, path, type, schema } = endpoint.toJSON()
    if (method === 'GET' && schema.parameters.length > 0) {
      // Only the first argument type is used by GET endpoints.
      schema.parameters = [transformGetParams(schema.parameters[0]!) as any]
    }
    return {
      name: name as string & keyof typeof API,
      path,
      method,
      schema,
      match: match(path),
      optionalReturn: type === 'json' && Value.Check(schema.returns, null),
      type,
    }
  })
}

export async function* encodeAsyncIterable(
  generator: AsyncGenerator<JsonValue, RpcPaginationResult | null | undefined>,
  endpoint: Endpoint,
  ctx: RpcContext
) {
  const iterator = generator[Symbol.asyncIterator]()
  while (true) {
    const result = await iterator.next()

    let encodedValue: any
    if (result.done) {
      const cursor = result.value || {}
      encodedValue = Value.Encode(Type.RpcPagination, {
        prev: cursor.prev ? createPaginationLink(ctx.url, cursor.prev) : null,
        next: cursor.next ? createPaginationLink(ctx.url, cursor.next) : null,
      })
    } else {
      encodedValue = Value.Encode(endpoint.schema.returns, result.value)
    }

    yield JSON.stringify(encodedValue)
    yield '\n'

    if (result.done) {
      return
    }
  }
}

export function createPaginationLink(url: URL, params: Record<string, any>) {
  url = new URL(url)
  for (const name in params) {
    url.searchParams.set(name, params[name])
  }
  return url.pathname + url.search
}
