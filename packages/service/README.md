# @alien-rpc/service

This packages provides type inference for the implementation of your RPC endpoints. It assumes you're using [Hattip](https://github.com/hattipjs/hattip), so `this` is typed as a Hattip request context.

### Step 1

Import your RPC endpoints and pass them to `createService`. Export the members of the returned service object for easy consumption. It's recommended you create a `context.ts` module for this step. Each module containing server functions will import this.

```ts
import { createService } from '@alien-rpc/service'
import * as API from './api'

export const { defineFunctions } = createService<typeof API>()
```

### Step 2

Create a module to implement your server functions. It's recommended to separate functions into logical groups, giving each group its own module. This makes it easy to split out specific services later on, in case you need to scale them in isolation once you hit the big time.

In the following example, `myService` has its arguments and return value automatically typed, because its `alien-rpc` endpoint already declared that information. If the endpoint has a route path like `/my-service/:id`, then the first argument of `myService` will be typed as `{ id: string }`. Afterwards, any other arguments (i.e. those declared with `endpoint.arg()`, `endpoint.object()`, etc) are also included with the type inference.

```ts
import { defineFunctions } from './context'

export default defineFunctions({
  myService(params, ...args) {
    // You can use `this` to set the response status or headers.
    this.status = 200
    this.headers['Cache-Control'] = 'public, max-age=31536000'

    // Return the response body.
    return { message: 'Hello, world!' }
  },
})
```
