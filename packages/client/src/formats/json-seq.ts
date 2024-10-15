import { ResponseStream, RpcPagination } from '../types.js'

export default (promisedResponse: Promise<Response>) => {
  // Keep a reference to the iterator, so we can attach previousPage
  //and nextPage methods when a pagination result is provided.
  let responseStream!: ResponseStream<any>

  return (responseStream = (async function* () {
    const response = await promisedResponse
    if (!response.body) {
      return
    }

    const { ObjectParser } = await import('@aleclarson/json-stream')

    for await (const object of response.body.pipeThrough(new ObjectParser())) {
      if (isPagination(object)) {
        if (object.$prev) {
          responseStream.previousPage = () =>
            send('get', prefixUrl + object.$prev, options) as any
        }
        if (object.$next) {
          responseStream.nextPage = () =>
            send('get', prefixUrl + object.$next, options) as any
        }
      } else {
        yield object
      }
    }
  })())
}

function isPagination(arg: object): arg is RpcPagination {
  // The server ensures both `prev` and `next` are defined, even though the
  // RpcPagination type says otherwise.
  return (
    Object.prototype.hasOwnProperty.call(arg, '$prev') &&
    Object.prototype.hasOwnProperty.call(arg, '$next') &&
    checkKeyCount(arg, 2)
  )
}

function checkKeyCount(object: object, count: number) {
  let i = 0
  for (const _ in object) {
    if (++i > count) {
      break
    }
  }
  return i === count
}
