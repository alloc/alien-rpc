export type CodableObject = { [key: string]: CodableValue }

export type CodableValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | CodableObject
  | readonly CodableValue[]
