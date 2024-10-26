// Declare this file a module.
export {}

type Simplify<T> = {} & { [K in keyof T]: T[K] }

/** Extract param types from a route path literal. */
export type InferParams<P extends string, Value = string> =
  InferParamFromPath<P> extends InferredParams<infer TRequiredParam>
    ? Simplify<{ [K in TRequiredParam]: Value }>
    : never

type InferParamFromPath<TPath extends string> =
  TPath extends `${infer TPrefix}/${infer TRest}`
    ? InferParam<TPrefix, InferParamFromPath<TRest>>
    : InferParam<TPath, { required: never }>

type InferParam<
  TPath extends string,
  TParams extends InferredParams,
> = TPath extends '*'
  ? AddRequiredParam<TParams, '*'>
  : TPath extends `${'*' | ':'}${infer TParam}`
    ? TParam extends ''
      ? TParams
      : AddRequiredParam<TParams, TParam>
    : TParams

type AddRequiredParam<
  TParams extends InferredParams,
  TParam extends string,
> = InferredParams<TParams['required'] | TParam>

interface InferredParams<TRequiredParam extends string = string> {
  required: TRequiredParam
}

/** Convert a route path literal to a template type. */
export type PathTemplate<P extends string> = P extends any
  ? P extends `${infer A}/${infer B}`
    ? PathTemplatePart<A, PathTemplate<B>>
    : PathTemplatePart<P>
  : never

type PathTemplatePart<
  Part extends string,
  Rest extends string = never,
> = Part extends `${'*' | ':'}${string}`
  ? PathConcat<string, Rest>
  : PathConcat<Part, Rest>

type PathConcat<Left extends string, Right extends string> = unknown &
  ([Left] extends [never]
    ? Right
    : [Right] extends [never]
      ? Left
      : `${Left}/${Right}`)
