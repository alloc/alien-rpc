type Simplify<T> = {} & { [K in keyof T]: T[K] }

/** Extract param types from a route path literal. */
export type InferParams<P extends string, Value = string> =
  InferParamFromPath<P> extends ParamNames<infer Required, infer Optional>
    ? Simplify<{ [K in Required]: Value } & { [K in Optional]?: Value }>
    : never

/** Convert a route path literal to a template type. */
export type PathTemplate<P extends string> = P extends any
  ? P extends `${infer A}/${infer B}`
    ? PathTemplatePart<A, PathTemplate<B>>
    : PathTemplatePart<P>
  : never

type InferParamFromPath<P extends string> = P extends `${infer A}/${infer B}`
  ? InferParam<A, InferParamFromPath<B>>
  : P extends `${infer A}&${infer B}`
    ? InferParam<A, InferParamFromPath<B>>
    : InferParam<P, { required: never; optional: never }>

type InferParam<
  T extends string,
  Acc extends ParamNames,
> = T extends `:${infer P}${'?' | '*'}`
  ? AddOptionalParam<Acc, P>
  : T extends `:${infer P}${'+' | ''}`
    ? AddRequiredParam<Acc, P>
    : Acc

type AddOptionalParam<PG extends ParamNames, P extends string> = ParamNames<
  PG['required'],
  PG['optional'] | P
>
type AddRequiredParam<PG extends ParamNames, P extends string> = ParamNames<
  PG['required'] | P,
  PG['optional']
>

interface ParamNames<R extends string = string, O extends string = string> {
  required: R
  optional: O
}

type PathTemplatePart<
  Part extends string,
  Rest extends string = never,
> = Part extends `:${string}${'?' | '*'}`
  ? Rest | PathConcat<string, Rest>
  : Part extends `:${string}${'+' | ''}`
    ? PathConcat<string, Rest>
    : PathConcat<Part, Rest>

type PathConcat<Left extends string, Right extends string> = unknown &
  ([Left] extends [never]
    ? Right
    : [Right] extends [never]
      ? Left
      : `${Left}/${Right}`)

export {}
