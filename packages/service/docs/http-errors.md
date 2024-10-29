# HTTP Errors

Your route can throw intentional errors, which result in specific HTTP status codes.

For example, this route throws an `UnauthorizedError`:

```ts
import { UnauthorizedError } from '@alien-rpc/service'

export const getPrivateProfile = route.get(
  '/users/:id/private',
  async ({ id }) => {
    const isAuthorized = await checkUserAuthorization(id)
    if (!isAuthorized) {
      throw new UnauthorizedError()
    }
    return await db.getUserPrivateProfile(id)
  }
)
```

You may provide a headers object to the error constructor to set additional HTTP headers.

```ts
throw new UnauthorizedError({
  'WWW-Authenticate': 'Bearer realm="api"',
})
```

### Supported errors

- `308` [PermanentRedirectError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308)
- `307` [TemporaryRedirectError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307)
- `400` [BadRequestError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400)
- `401` [UnauthorizedError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401)
- `403` [ForbiddenError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403)
- `409` [ConflictError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409)
- `410` [GoneError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410)
- `411` [LengthRequiredError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/411)
- `412` [PreconditionFailedError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/412)
- `413` [PayloadTooLargeError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413)
- `415` [UnsupportedMediaTypeError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/415)
- `416` [RangeNotSatisfiableError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416)
- `417` [ExpectationFailedError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/417)
- `421` [MisdirectedRequestError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/421)
- `422` [UnprocessableContentError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422)
- `428` [PreconditionRequiredError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/428)
- `429` [TooManyRequestsError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- `451` [UnavailableForLegalReasonsError](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/451)
