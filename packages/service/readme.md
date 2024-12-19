# @alien-rpc/service

This package is used by your backend code to define your API routes. It's a simplistic library without many features, as it relies on other libraries (e.g. [hattip](https://github.com/hattipjs/hattip), [typebox](https://github.com/sinclairzx81/typebox), and [pathic](https://github.com/alloc/alien-rpc/tree/master/packages/pathic)) to handle the heavy lifting.

The rest of this document will teach you how to define routes, document them, validate their input/output data, and expose them over HTTP.

&nbsp;

## Defining routes

First, let's define a GET route. We'll need a _path pattern_ (a string literal) and a _route handler_ (a plain old JavaScript function).

```ts
import { route } from '@alien-rpc/service'

export const getUser = route.get('/users/:id', async ({ id }) => {
  // TODO: return some JSON-compatible data
})
```

For more on the path pattern syntax, see the “Path patterns” section of the [Pathic readme](https://github.com/alloc/alien-rpc/tree/master/packages/pathic#readme).

Your routes can be declared anywhere in your codebase, as long as they are _exported_ and the `alien-rpc` generator is told where to find them. It's best practice to have dedicated modules for your routes (i.e. avoid declaring them alongside other exports that aren't routes).

If you prefer all-caps HTTP methods, you can use the exported `route.GET` function instead. There is no functional difference, but it's a matter of personal preference.

### Route Arguments

If a route has path parameters, its handler will have 3 arguments (`pathParams`, `requestData`, `ctx`). Otherwise, it will have 2 (`requestData`, `ctx`). The `requestData` is an object of either the route's search parameters (for GET/DELETE/HEAD routes) or its JSON body (for POST/PUT/PATCH routes). The `ctx` argument is the request context, as defined by [hattip](https://github.com/hattipjs/hattip/tree/main/packages/base/compose#requestcontext).

#### Path parameters

If a route has exactly 1 path parameter, its `pathParams` argument will be a single value. If a route has multiple path parameters, `pathParams` will be an array of values. If you don't explicitly type the `pathParams` argument, each parameter value is typed as a `string`.

```ts
const getUser = route.get('/users/:id', async id => {
  // typeof id === 'string'
})

const getUserInGroup = route.get(
  '/groups/:groupId/users/:userId',
  async ([groupId, userId]) => {
    // typeof groupId === 'string'
    // typeof userId === 'string'
  }
)
```

### Supported HTTP methods

The following HTTP methods are supported:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- `OPTIONS`  
  No need to manually define this route, as it's handled internally.
- `HEAD`  
  While you can define a HEAD route, your GET routes will also match HEAD requests. You can check for this in your route handler via `ctx.request.method === "HEAD"`. Even if your route handler returns a response body, it will be ignored for HEAD requests.

&nbsp;

## Documenting routes

Routes can be documented like any TypeScript function.

```ts
/**
 * Retrieve the public profile for a given user.
 *
 * @param id - The ID of the user to retrieve.
 */
const getUser = route.get('/users/:id', async id => {
  // ...
})
```

This documentation is extracted by [@alien-rpc/generator](https://github.com/alloc/alien-rpc/tree/master/packages/generator) and included with the client's type definitions.

Currently, this works for routes, but not their path parameters or request data. This feature is being tracked in [#3](https://github.com/alloc/alien-rpc/issues/3) (contributions welcome).

&nbsp;

## Runtime validation

TypeScript types are used by [@alien-rpc/generator](https://github.com/alloc/alien-rpc/tree/master/packages/generator) to determine how your route's path parameters and request data should be validated at runtime.

So if your `getUser` route is expecting the `id` path parameter to be a number and the `includePrivate` search parameter to be a boolean, you can define it like this:

```ts
import { route } from '@alien-rpc/service'

const getUser = route.get(
  '/users/:id',
  async (id: number, searchParams: { includePrivate?: boolean }) => {
    // ...
  }
)
```

Note that you can also explicitly type your request data, which in case you forgot, is the 2nd argument to your route handler that represents the JSON request body (for POST/PUT/PATCH routes) or search parameters (for GET/HEAD/DELETE routes).

#### Path parameter limitations

Path parameters can only be one of the following types: `string`, `number`, or an array of those types. In the case of an array, the path parameter will be split by any `/` characters within it, which is probably only useful for wildcard parameters (e.g. `/files/*filename`).

#### Date parsing

You may use the `Date` type for your “request data” to parse a string into a `Date` object. As implied in the previous section, this is not supported for path parameters.

This even works for POST/PUT/PATCH request bodies, which use JSON encoding. Basically, the date will be serialized to the ISO-8601 format during transport, and parsed back into a `Date` object upon arrival.

### Type constraints

Sometimes, TypeScript types aren't strict enough for your use case. For example, you might expect the `id` parameter of your `getUser` route to be an integer greater than 0.

For this, you can use the “type tags” feature:

```ts
import { route, t } from '@alien-rpc/service'

const getUser = route.get(
  '/users/:id',
  async ({ id }: { id: number & t.MultipleOf<1> & t.Minimum<1> }) => {
    // ...
  }
)
```

Type constraints are supported everywhere TypeScript types are supported, including path parameters, request data, and response data.

The [Type Constraints](./docs/type-constraints.md) page has more information on the available constraints.

&nbsp;

## Request context

The request context is the last argument of your route handler. It's an object containing information about the incoming request, such as the request method, headers, and URL. [See here](https://github.com/hattipjs/hattip/tree/main/packages/base/compose#requestcontext) for a complete list of properties and methods in the `RequestContext` type.

Note that your route handler _always_ receives an object representing the _request data_ (either search parameters or JSON body). Therefore, to access the request context, you need to declare an argument name for the request data first. See `_data` in the example below:

```ts
export const getApplStockPrice = route.get(
  '/stocks/appl',
  async (_data, ctx) => {
    ctx.url // => [object URL]
    ctx.request.url // => "/stocks/appl"
    ctx.request.headers // => [object Headers]
  }
)
```

### Response manipulation

The request context contains a `response` object property with a `status` number and a `headers` object. You can modify these properties to customize the HTTP response.

```ts
export const getFile = route.get('/files/:id', async (id, _, ctx) => {
  ctx.response.status = 200 // Note: The default status is 200

  ctx.response.headers.set('Content-Type', 'application/pdf')
  ctx.response.headers.set(
    'Content-Disposition',
    'attachment; filename="file.pdf"'
  )

  return await getFileContents(id)
})
```

&nbsp;

## Exposing routes over HTTP

The `compileRoutes` function creates a middleware function that can be used with [hattip](https://github.com/hattipjs/hattip/tree/main/packages/base/compose). It expects an array of route definitions, which are located wherever you set `--serverOutFile` to when running [@alien-rpc/generator](https://github.com/alloc/alien-rpc/tree/master/packages/generator) through the CLI (it defaults to `./server/generated/api.ts`).

```ts
import { compose } from '@hattip/compose'
import { compileRoutes } from '@alien-rpc/service'
import routes from './server/generated/api.js'

export default compose(
  loggingMiddleware(), // <-- runs before your routes
  compileRoutes(routes),
  ssrMiddleware() // <-- runs after your routes
)
```

> [!NOTE]
> In the example above, the `loggingMiddleware` and `ssrMiddleware` are hypothetical. Creating your own [middleware](https://github.com/hattipjs/hattip/tree/main/packages/base/compose#handler) is as easy as declaring a function (optionally `async`) that receives a `RequestContext` object and returns one of the following: a `Response` object, any object with a `toResponse` method, or nothing (aka `void`).

If you save the code above in the `./server/handler.ts` module, you could start your server in the `./server/main.ts` module like this:

```ts
import { createServer } from '@hattip/adapter-uwebsockets'
import handler from './handler.js'

createServer(handler).listen(3000, 'localhost', () => {
  console.log('Server listening on http://localhost:3000')
})
```

&nbsp;

## Error handling

Currently, error handling is performed by the `compileRoutes` function.

Errors thrown by your route handlers are assumed to be unintentional, unless you throw an `HttpError` instance like so:

```ts
import { route, UnauthorizedError } from '@alien-rpc/service'

export const getPrivateProfile = route.get('/users/:id/private', async id => {
  throw new UnauthorizedError()
})
```

For more details, see the [HTTP errors](./docs/http-errors.md) page.

&nbsp;

## Streaming responses

If you want to stream JSON to the client, define your route handler as an async generator:

```ts
import { route } from '@alien-rpc/service'

export const streamPosts = route.get('/posts', async function* () {
  yield { id: 1, title: 'First post' }
  yield { id: 2, title: 'Second post' }
})
```

This takes advantage of the [JSON Text Sequence](https://www.rfc-editor.org/rfc/rfc7464.html) format. Any JSON-compatible data can be yielded by your route handler. This allows the client to start receiving data before the route handler has finished executing.

### Reserved keys

For generator-based routes, you must never yield objects of the following shape:

- `{ $error: any }`
- `{ $prev: any; $next: any }`

These yield types are reserved for pagination and error handling.

### Pagination

The `paginate` function allows you to provide pagination links in the response. This is only supported for routes whose handler is an async generator.

**Please note** that only GET routes support pagination.

The `paginate` function takes two arguments:

- `route`: A reference to the current route (via `this`) or another route (by the identifier you exported it with)
- `links`: An object with the `prev` and `next` pagination links, which must provide an object containing path parameters and/or search parameters for the next/previous set of results

You _must_ return the `paginate` function's result from your route handler.

```ts
import { route, paginate } from '@alien-rpc/service'

export const streamPosts = route.get(
  '/posts',
  async function* ({ offset, limit }: { offset: number; limit: number }) {
    let count = 0
    for await (const post of db.posts.find({ offset, limit })) {
      yield post
      count++
    }
    return paginate(this, {
      prev: offset > 0 ? { offset: offset - limit, limit } : null,
      next: count === limit ? { offset: offset + limit, limit } : null,
    })
  }
)
```

Pagination is an optional feature. It not only supports an offset+limit style of pagination, but any other kind, like cursor-based pagination. When calling a paginated route through the `alien-rpc` client, two methods (`previousPage` and `nextPage`) are added to the `ResponseStream` object returned by that route's client method.

### Streaming arbitrary data

If you need to stream data that isn't JSON, your route's handler needs to return a `Response` object whose body is a `ReadableStream`.

```ts
import { route } from '@alien-rpc/service'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Readable } from 'node:stream'

export const downloadFile = route.get('/files/*filename', async filename => {
  const fileStream = fs.createReadStream(path.join('./uploads', filename))

  return new Response(Readable.toWeb(fileStream), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
```

&nbsp;

## Conclusion

This concludes the documentation for `@alien-rpc/service`. Be sure to check out the documentation for the other packages in this library:

- [alien-rpc](https://github.com/alloc/alien-rpc/tree/master/packages/alien-rpc#readme) _An umbrella package containing the CLI, generator, client, and service packages_
- [@alien-rpc/generator](https://github.com/alloc/alien-rpc/tree/master/packages/generator#readme) _The code generator for your API routes_
- [@alien-rpc/client](https://github.com/alloc/alien-rpc/tree/master/packages/client#readme) _The HTTP client for your API_

If you still have questions, please [open an issue](https://github.com/alloc/alien-rpc/issues/new) and I'll do my best to help you out.
