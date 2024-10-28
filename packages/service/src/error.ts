import { isError } from 'radashi'

const kHttpError = Symbol('HttpError')

export abstract class HttpError {
  readonly [kHttpError] = true

  abstract status: number
  constructor(readonly headers?: HttpError.Headers) {}

  static isHttpError(error: unknown): error is HttpError {
    return isError(error) && error.hasOwnProperty(kHttpError)
  }
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308
 */
export class PermanentRedirectError extends HttpError {
  name = 'PermanentRedirectError'
  status = 308
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
 */
export class TemporaryRedirectError extends HttpError {
  name = 'TemporaryRedirectError'
  status = 307
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400
 */
export class BadRequestError extends HttpError {
  name = 'BadRequestError'
  status = 400
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
 */
export class UnauthorizedError extends HttpError {
  name = 'UnauthorizedError'
  status = 401
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403
 */
export class ForbiddenError extends HttpError {
  name = 'ForbiddenError'
  status = 403
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409
 */
export class ConflictError extends HttpError {
  name = 'ConflictError'
  status = 409
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410
 */
export class GoneError extends HttpError {
  name = 'GoneError'
  status = 410
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/411
 */
export class LengthRequiredError extends HttpError {
  name = 'LengthRequiredError'
  status = 411
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/412
 */
export class PreconditionFailedError extends HttpError {
  name = 'PreconditionFailedError'
  status = 412
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413
 */
export class PayloadTooLargeError extends HttpError {
  name = 'PayloadTooLargeError'
  status = 413
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/415
 */
export class UnsupportedMediaTypeError extends HttpError {
  name = 'UnsupportedMediaTypeError'
  status = 415
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416
 */
export class RangeNotSatisfiableError extends HttpError {
  name = 'RangeNotSatisfiableError'
  status = 416
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/417
 */
export class ExpectationFailedError extends HttpError {
  name = 'ExpectationFailedError'
  status = 417
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/421
 */
export class MisdirectedRequestError extends HttpError {
  name = 'MisdirectedRequestError'
  status = 421
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422
 */
export class UnprocessableContentError extends HttpError {
  name = 'UnprocessableContentError'
  status = 422
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/428
 */
export class PreconditionRequiredError extends HttpError {
  name = 'PreconditionRequiredError'
  status = 428
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
 */
export class TooManyRequestsError extends HttpError {
  name = 'TooManyRequestsError'
  status = 429
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/451
 */
export class UnavailableForLegalReasonsError extends HttpError {
  name = 'UnavailableForLegalReasonsError'
  status = 451
}

export declare namespace HttpError {
  type Headers = Record<string, string> & CommonHeaders

  interface CommonHeaders {
    /**
     * Indicates how long the client should wait before making a follow-up
     * request. Common with 429 (Too Many Requests)
     */
    'Retry-After'?: string

    /**
     * Indicates the media type of the response body. Common with 400 (Bad
     * Request) and 415 (Unsupported Media Type) to specify supported formats
     */
    'Content-Type'?: string

    /**
     * Defines the authentication method and parameters. Used with 401
     * (Unauthorized) to indicate how to authenticate properly
     */
    'WWW-Authenticate'?: string

    /**
     * Size of the response body in bytes. Used with 413 (Payload Too Large)
     * to indicate size limits
     */
    'Content-Length'?: string

    /**
     * Indicates the range of content being sent. Used with 416 (Range Not
     * Satisfiable) for failed range requests
     */
    'Content-Range'?: string

    /**
     * URL where the requested resource can be found. Common with 307/308
     * (Redirects) for resource moved
     */
    Location?: string

    /**
     * A comma-separated list of links to related resources. Common with 451
     * (Unavailable For Legal Reasons) to indicate related resources
     */
    Link?: string
  }
}
