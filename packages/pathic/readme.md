# pathic

TypeScript library for URI path matching. Focused on a blend of efficiency and simplicity.

**Features:**
- `InferParams` type for deriving an object type from a path pattern.
- `PathTemplate` type for creating a template literal type from a path pattern.
- `compilePaths` for compiling an array of paths into a function that efficiently matches a path to an index in the array. Paths are sorted by specificity and parameters are parsed.
- `buildPath` for turning a path pattern and an object of parameters into a string.
- `parsePathParams` for returning an array of parameter names in the path.

#### Path patterns

- **Fixed routes** `/foo`
  Only matches `/foo` and takes precedence over all other patterns.

- **Named parameters** `/foo/:bar`
  Matches `/foo/123` but not `/foo/123/456`.

- **Catch-all parameters** `/foo/*bar`
  Matches any path starting with `/foo/` but not `/foo`.

- **Unnamed catch-all parameters** `/foo/*`
  Matches any path starting with `/foo/` but the tail isn't included in the
  parsed parameter values. Only one unnamed catch-all parameter is allowed.

&nbsp;

#### API

### parsePathParams

Returns an array of parameter names in the path.

```ts
parsePathParams('/foo/:bar/*baz') // => ['bar', 'baz']
```

### compilePaths

Compiles an array of paths into a function that matches a path to an index in the array. This function is order-independent, since it internally sorts the paths by specificity.

If your callback returns anything other than `undefined`, matching stops and the result is returned. Otherwise, the next matching path is tried.

```ts
const routes = [
  ['/foo', () => 1],
  ['/foo/:bar', ({ bar }) => [2, bar]],
  ['/foo/*bar', ({ bar }) => [3, bar]],
  ['/foo/*bar/baz', ({ bar }) => [4, bar]],
]

const match = compilePaths(routes.map(([path]) => path))

const handle = (index: number, params: Record<string, string>) => {
  const [, handler] = routes[index]
  return handler(params)
}

match('/foo', handle) // => 1
match('/foo/bar', handle) // => [2, 'bar']
match('/foo/bar/baz', handle) // => [4, 'bar']
match('/foo/bar/bie', handle) // => [3, 'bar/bie']
match('/404', handle) // => undefined
```

### buildPath

Turns a path and a params object into a string. If a parameter is an array, it is joined with slashes. If a parameter is missing, an error is thrown. Otherwise, the parameter is stringified.

```ts
buildPath('/foo/:bar', { bar: 'baz' }) // => '/foo/baz'
buildPath('/foo/:bar', { bar: ['bar', 'bie'] }) // => '/foo/bar/bie'
buildPath('/foo/:bar', { bar: undefined }) // => throws Error
```

&nbsp;

#### Types

### InferParams

Derive an object type from a path pattern.

### PathTemplate

Create a template literal type from a path pattern.
