import { RequestOptions, ResponseStream, RpcRoute } from '@alien-rpc/client'
import jsonSeq from '@alien-rpc/client/formats/json-seq'

export const streamNumbers = {path: "numbers", method: "get", jsonParams: [], arity: 1, format: jsonSeq} as RpcRoute<"numbers", (requestOptions?: RequestOptions) => ResponseStream<1 | 2 | 3>>