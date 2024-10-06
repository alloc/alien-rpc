# alien-rpc

## Features

- Type-safe RPC routes with TypeScript and compile-time code generation
- HTTP client powered by [Ky](https://github.com/sindresorhus/ky) and a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) wrapper for low memory footprint
- REST semantics with explicitly defined HTTP methods and URIs for each route
- No batched requests or funneling through a single endpoint
- Backend, runtime type validation powered by [TypeBox](https://githubß.com/sinclairzx81/typebox) and auto-generated at compile-time from your TypeScript definitions
- Automatic API versioning that allows for gradual deprecation of older versions
- [NDJSON](https://github.com/ndjson/ndjson-spec) response streams powered by [async generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)
- Express-style “path parameters” (e.g. `/users/:id`) via [path-to-regexp](https://github.com/pillarjs/path-to-regexp)
- Compact serialization of complex URI search parameters via [JURI](/tree/main/packages/@alien-rpc/juri)
- Based on [Hattip.js](https://github.com/hattipjs/hattip) for HTTP server and middleware

## Development

- It's recommended to run your server with [vite-node](https://www.npmjs.com/package/vite-node) during development, so that you can hot reload your server.
