export type Promisable<T> = T | Promise<T>

export type JSON = import('../typebox/json.js').JsonValue

// https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546
export type NoInfer<T> = [T][T extends any ? 0 : never]
