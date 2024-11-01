# alien-rpc

RPC/REST hybrid middleware for Node.js and Bun. Comes with a type-safe client library, pure-TypeScript request validation, and JSON streaming. Powered by popular open-source libraries, like [Ky](https://github.com/sindresorhus/ky), [TypeBox](https://github.com/sinclairzx81/typebox), and [Hattip](https://github.com/hattipjs/hattip).

## Features

- Type-safe RPC routes with TypeScript and compile-time code generation
- HTTP client powered by [ky](https://github.com/sindresorhus/ky) and a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) wrapper for low memory footprint
- REST semantics with explicitly defined HTTP methods and URIs for each route
- No batched requests or funneling through a single endpoint, allowing for easy debugging and usage tracking
- Request/response validators are auto-generated at compile-time from your TypeScript definitions (powered by [typebox](https://github.com/sinclairzx81/typebox) and [typebox-codegen](https://github.com/sinclairzx81/typebox-codegen))
- Streaming JSON responses powered by [async generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) and the [JSON Text Sequence](https://www.rfc-editor.org/rfc/rfc7464.html) RFC
- Type-safe route parameters (e.g. `/users/:id` or `/foo/*bar`) and efficient route matching via [pathic](./packages/pathic)
- Full JSON support in compact query strings via [json-qs](https://github.com/alloc/json-qs)
- Based on [Hattip.js](https://github.com/hattipjs/hattip) for HTTP server and middleware, with adapters for many target platforms

## Install

In the root directory of your project, install the `alien-rpc` package:

```sh
pnpm add alien-rpc
```

This package contains the CLI, code generator, client library, and server library.

In the root directory _of your backend_, install TypeBox for runtime validation:

```sh
pnpm add @sinclair/typebox
```

## The Basics

Alien RPC is unopinionated about your project structure, but it's assumed your client code and server code are in separate directories.

> [!IMPORTANT]
> Before you use the code generator, you'll want to get familiar with how to define routes. Give [this page](https://github.com/alloc/alien-rpc/tree/master/packages/service#readme) a read, then come back here afterwards.

The code generator can be customized with a variety of options. You can use the `--help` flag to see all the options available. For now, we'll keep it simple and use only a few.

By default, the code generator assumes you'll run it from the root directory of your project (the one that contains your `client` and `server` package directories). It will emit _route definitions_ to the `client/generated/api.ts` and `server/generated/api.ts` files, unless told otherwise via the `--clientOutFile` and `--serverOutFile` options respectively. Feel free to customize this to match your project structure.

### API Versioning

With the `--versionPrefix` option, you can prefix every route with an API version.

For example, using `--versionPrefix v1` would turn the `/foo` route into `/v1/foo`. Note that you could use any prefix you want (e.g. a date or a name), not just a version number.

This allows for breaking changes to your API without breaking existing client applications. Currently, you're on the hook for managing and deploying multiple versions of your API's server code, which is necessary during the gradual migration process.

### Running the Code Generator

The code generator _must_ be told where to find your routes, which is typically done with a glob pattern. At this point, you should have at least one route defined in your server code. I like to keep my routes in the `src/api` directory of my server package, so we'll use that in the following example. Any unflagged arguments will be interpreted as glob patterns, used to search for routes:

```sh
pnpm alien-rpc src/api/**/*.ts \
  --clientOutFile client/generated/api.ts \
  --serverOutFile server/generated/api.ts \
  --versionPrefix v1 \
  --watch
```

The `--watch` flag will automatically re-run the code generator when your routes change, including any modules you import from.

## Development

When developing your API, you can run your TypeScript code directly with the following command:

```sh
node --watch --experimental-strip-types server/src/main.ts
```

This assumes you have the latest Node.js version installed.

Once you're ready to deploy your API, you can compile your TypeScript code with a number of different tools. This is currently beyond the scope of this guide.

## Limitations

Please be aware of the following limitations:

- Routes must return JSON-compatible types, an iterator that yields JSON-compatible types, or a `Response` object.
- Recursive types are forbidden in route signatures.

If you find any other limitations, please [open a pull request](https://github.com/alloc/alien-rpc/pulls) to update this list.

## License

[MIT](./LICENSE.md)
