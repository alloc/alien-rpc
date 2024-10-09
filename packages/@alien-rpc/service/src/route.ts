import { InferParams } from '@alloc/path-types'
import { RequestContext } from '@hattip/compose'

type Promisable<T> = T | Promise<T>
type EmptyRecord = Record<keyof any, never>

type JSON = { [key: string]: JSON } | readonly JSON[] | JSONValue
type JSONValue = string | number | boolean | null | undefined

export type ValidResult =
  | Promisable<Response | IterableIterator<JSON> | JSON>
  | AsyncIterableIterator<JSON>

export function get<
  Path extends string,
  SearchParams extends object = EmptyRecord,
  Result extends ValidResult = any,
>(
  path: Path,
  handler: (
    pathParams: InferParams<Path>,
    searchParams: SearchParams,
    request: RequestContext
  ) => Result
) {
  return { method: 'get', path, handler } as const
}

export function post<
  Path extends string,
  Body extends object = EmptyRecord,
  Result extends ValidResult = any,
>(
  path: Path,
  handler: (
    pathParams: InferParams<Path>,
    body: Body,
    request: RequestContext
  ) => Result
) {
  return { method: 'post', path, handler } as const
}
