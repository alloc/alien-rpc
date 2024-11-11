# @alien-rpc/client

This package wraps a [Ky](https://github.com/sindresorhus/ky) client with a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) that allows you to call your API routes as TypeScript methods.

> [!NOTE]
> Typically, you should install `alien-rpc` instead of this package directly, then import from this package via `alien-rpc/client`.

```ts
// client/index.ts
import { defineClient } from '@alien-rpc/client'
import * as API from './generated/api.js'

export default defineClient(API)
```

Where you import the generated `API` namespace depends on what you passed to the `alien-rpc` CLI (or the `@alien-rpc/generator` library). The default path is `./client/generated/api.ts` relative to your root directory. The `--clientOutFile` option can be used to change this.

### Options

The `defineClient` function also accepts an options object, which supports [all Ky options](https://github.com/sindresorhus/ky?tab=readme-ov-file#options) in addition to the following:

- `errorMode`: A string that determines how errors are handled by the client.
  - `'reject'`: Errors reject the query promise. _This is the default._
  - `'return'`: Errors are returned as a tuple with the error as the first element and the result as the second element. If an error is returned, the result will be `undefined`, and vice versa.
- `resultCache`: A cache for storing the results of your `GET` routes. This cache is checked before sending a `GET` request. It remains empty until you manually call the `Client#setCachedResponse` method.
  - Probably the only time you might set this is if you want a “least-recently-used” cache (e.g. you might use [quick-lru](https://github.com/sindresorhus/quick-lru)), whereas the default cache is a simple `Map` whose size is unbounded.

In TypeScript, you can use the `ClientOptions` type whenever you have an object variable/parameter whose properties should match the options supported by `defineClient`.

### Methods

Every RPC route found by [@alien-rpc/generator](https://github.com/alloc/alien-rpc/tree/master/packages/generator) will be available as a method on the `Client` object.

Each client also has the following methods:

- `extend(options: ClientOptions)`: Create a client with the given options, using the current client as a source of default options.
- `getCachedResponse(path: string)`: Get a cached response for a given path.
- `setCachedResponse(path: string, response: unknown)`: Manually set a cached response for a given path.
- `unsetCachedResponse(path: string)`: Manually unset a cached response for a given path.
- `request(input, init?)`: Send an unsafe request using the underlying [Ky](https://github.com/sindresorhus/ky) client. This is also a reference to the underlying `ky` client, so you can use all of its methods.

## Example

An end-to-end example is in the works.

For now, you can take a look at [the test snapshots](https://github.com/alloc/alien-rpc/tree/master/test/generator/__snapshots__) to get an idea of what the generated code looks like.
