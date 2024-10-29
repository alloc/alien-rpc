export type Promisable<T> = T | Promise<T>

type JSONPrimitive = string | number | boolean | null

export type JSONObjectCodable =
  | { [key: string]: JSONCodable | undefined }
  | { toJSON(): JSONObjectCodable }

export type JSONCodable =
  | JSONPrimitive
  | { [key: string]: JSONCodable | undefined }
  | { toJSON(): JSONCodable }
  | readonly JSONCodable[]

export type JSONObject = { [key: string]: JSON | undefined }

export type JSON = JSONPrimitive | JSONObject | readonly JSON[]

// https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546
export type NoInfer<T> = [T][T extends any ? 0 : never]
