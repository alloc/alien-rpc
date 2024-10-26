# @alloc/path-types

A simple package for type-level manipulation of route paths (i.e. `/foo/:bar`)

## Usage

The two types included are `InferParams` and `PathTemplate`.

The `InferParams` type expects a route path string literal. It tells the type checker how to parse route paths in order to extract “route parameter names” (the `:bar` part in `/foo/:bar`) from them. It returns an object type whose keys are the route parameters. By default, the property values are a `string` type, but this can be customized with the 2nd type parameter.

```ts
type Params = InferParams<'/foo/:bar'>
// => { bar: string }
```

The `PathTemplate` type also expects a route path string literal. It returns a template string type where the route parameters are replaced with `${string}`, so the type is useful for pathname construction.

```ts
type Pathname = PathTemplate<'/foo/:bar'>
// => `/foo/${string}`
```
