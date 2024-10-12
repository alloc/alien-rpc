export type Promisable<T> = T | Promise<T>

export type JSON = { [key: string]: JSON } | readonly JSON[] | JSONValue
export type JSONValue = string | number | boolean | null | undefined

// https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546
export type NoInfer<T> = [T][T extends any ? 0 : never]
