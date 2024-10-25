# json-qs

A query string encoder and decoder with full JSON compatibility, no wasteful repetition of keys, and minimal percent-encoding bloat.

#### Requirements

- Must be human-readable.
- Must be fully compatible with JSON.
- Must not rely on percent-encoding. In other words, there must be zero ambiguity after `URLSearchParams` has decoded the query string.
- Must have deterministic key order (for reliable caching).

#### Why make this?

The standard for query strings is unfriendly to JSON objects and arrays, or at best, overly verbose with repeated keys. Also, backend developers are required to manually decode the string values into their intended types.

Okay, so why not avoid query strings for complex data, and just POST some JSON instead? Network-level caching of POST requests is not possible, so you'd need to implement your own application-level caching. By using GET with a query string, you can leverage the browser's built-in caching mechanism, as well as edge caching.

The `json-qs` approach is to keep query strings human-readable (unlike many others, who compress JSON to make it URI-safe) while still being fully compatible with JSON. The only time that readability is sacrificed is when a few special characters need to be rewritten to avoid ambiguity.

### Specification

See the [specification](./spec.md) for more details.

### Encoding

```ts
import { encode } from 'json-qs'

const params = encode({ a: { b: 0 } })
// => 'a={b:0}'
```

### Decoding

Note that the `json-qs` decoder works _in tandem_ with `URLSearchParams`, which is the standard JavaScript API for working with query strings. Percent encoding is handled by `URLSearchParams`, and `json-qs` simply ensures that the query string is fully compatible with JSON in a human-readable way.

```ts
import { decode } from 'json-qs'

const url = new URL(request.url)
const params = decode(url.searchParams)
```
