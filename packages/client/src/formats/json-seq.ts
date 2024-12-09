import { Client } from '../client.js'
import {
  RequestOptions,
  ResponseStream,
  ResultFormatter,
  RoutePagination,
} from '../types.js'

export default {
  mapCachedResult,
  parseResponse,
} satisfies ResultFormatter<ResponseStream<any>, unknown[]>

function parseResponse(promisedResponse: Promise<Response>, client: Client) {
  // This reference is used to attach previousPage and nextPage methods
  // when a pagination result is provided.
  let responseStream!: ResponseStream<any>

  async function* parse() {
    const response = await promisedResponse
    if (!response.body) {
      return
    }
    const parser = new TransformStream(parseJSONSequence())
    for await (const value of response.body.pipeThrough(parser)) {
      if (value && isPagination(value)) {
        attachPageMethods(responseStream, value, client)
      } else {
        yield value
      }
    }
  }

  responseStream = parse() as any
  responseStream.toArray = toArray
  return responseStream
}

function mapCachedResult(values: unknown[], client: Client) {
  let responseStream!: ResponseStream<any>

  async function* parse() {
    if (!values.length) {
      return
    }
    const lastValue = values[values.length - 1]
    if (lastValue && isPagination(lastValue)) {
      attachPageMethods(responseStream, lastValue, client)
      values = values.slice(0, -1)
    }
    yield* values
  }

  responseStream = parse() as any
  responseStream.toArray = toArray
  return responseStream
}

async function toArray(this: AsyncGenerator<any>) {
  const result = []
  for await (const value of this) {
    result.push(value)
  }
  return result
}

function requestPage(client: Client, path: string, options?: RequestOptions) {
  const values = client.getCachedResponse(path) as any[] | undefined
  return values
    ? mapCachedResult(values, client)
    : parseResponse(client.request(path, options), client)
}

function attachPageMethods(
  responseStream: ResponseStream<any>,
  object: RoutePagination,
  client: Client
) {
  if (object.$prev) {
    responseStream.previousPage = options =>
      requestPage(client, object.$prev!, options)
  }
  if (object.$next) {
    responseStream.nextPage = options =>
      requestPage(client, object.$next!, options)
  }
}

function isPagination(arg: {}): arg is RoutePagination {
  // The server ensures both `prev` and `next` are defined, even though the
  // RpcPagination type says otherwise.
  return (
    Object.prototype.hasOwnProperty.call(arg, '$prev') &&
    Object.prototype.hasOwnProperty.call(arg, '$next') &&
    hasExactKeyCount(arg, 2)
  )
}

function hasExactKeyCount(object: {}, count: number) {
  let i = 0
  for (const _ in object) {
    if (++i > count) {
      break
    }
  }
  return i === count
}

function parseJSONSequence(): Transformer<Uint8Array, object> {
  const decoder = new TextDecoder()
  const separator = 0x1e // ASCII code for Record Separator

  let buffer = new Uint8Array(0)

  return {
    transform(chunk: Uint8Array, controller) {
      buffer = concatUint8Arrays(buffer, chunk)

      // Assume the first byte is always a record separator.
      let startIndex = 1
      let endIndex: number

      while ((endIndex = buffer.indexOf(separator, startIndex)) !== -1) {
        const text = decoder.decode(buffer.subarray(startIndex, endIndex))
        controller.enqueue(JSON.parse(text))

        // Skip the next record separator.
        startIndex = endIndex + 1
      }

      if (startIndex > 1) {
        buffer = buffer.subarray(startIndex - 1)
      }
    },
    flush(controller) {
      if (buffer.length) {
        const text = decoder.decode(buffer.subarray(1))
        controller.enqueue(JSON.parse(text))
      }
    },
  }
}

function concatUint8Arrays(
  a: Uint8Array,
  b: Uint8Array
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(a.length + b.length)
  result.set(a, 0)
  result.set(b, a.length)
  return result
}
