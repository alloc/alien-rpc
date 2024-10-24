import { isArray } from 'radashi'
import { CodableObject, CodableValue } from './types.js'

export type EncodeOptions = {
  skippedKeys?: string[]
}

export function encode(obj: CodableObject, options?: EncodeOptions): string {
  return encodeProperties(obj, false, options?.skippedKeys)
}

function encodeProperties(
  obj: CodableObject,
  nested: boolean,
  skippedKeys?: string[]
): string {
  let separator: string
  let delimiter: string
  let encodeKey: (key: string) => string
  let filterKey: ((key: string) => boolean) | undefined

  if (nested) {
    separator = ','
    delimiter = ':'
    encodeKey = encodeString
  } else {
    separator = '&'
    delimiter = '='
    encodeKey = encodeURIComponent
    if (skippedKeys) {
      filterKey = key => obj[key] !== undefined && !skippedKeys.includes(key)
    }
  }

  const keys = Object.keys(obj)
    .filter(filterKey || (key => obj[key] !== undefined))
    .sort()

  let key: string
  let result = ''

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    result +=
      (result ? separator : '') +
      encodeKey(key) +
      delimiter +
      (nested && obj[key] === ''
        ? i !== keys.length - 1
          ? ''
          : ','
        : encodeValue(obj[key]))
  }
  return result
}

function encodeValue(value: CodableValue): string {
  if (value === null || value === true || value === false) {
    return String(value)
  }
  if (typeof value === 'string') {
    // Strings equal to these constants must be escaped.
    if (value === 'null' || value === 'true' || value === 'false') {
      return '\\' + value
    }
    return encodeString(value)
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 'null'
    }
    return String(value).replace('e+', 'e')
  }
  if (isArray(value)) {
    return encodeArray(value)
  }
  if (typeof value === 'object') {
    return encodeObject(value)
  }
  if (typeof value === 'bigint') {
    return String(value) + 'n'
  }
  throw new Error(`Unsupported value type: ${typeof value}`)
}

function encodeArray(array: readonly CodableValue[]): string {
  let result = ''
  for (let i = 0; i < array.length; i++) {
    result +=
      (result ? ',' : '') +
      (array[i] === undefined
        ? null
        : array[i] === ''
          ? i !== array.length - 1
            ? ''
            : ','
          : encodeValue(array[i]))
  }
  return `(${result})`
}

function encodeObject(obj: CodableObject): string {
  return `{${encodeProperties(obj, true)}}`
}

function isCharacterSniffable(charCode: number): boolean {
  return (
    // digit (implies a number)
    (charCode >= 48 && charCode <= 57) ||
    // hyphen (implies a negative number)
    charCode === 45 ||
    // backslash (implies an escape sequence)
    charCode === 92
  )
}

function encodeString(str: string): string {
  // For the first character in a string, we need to escape characters that
  // are used to sniff other data types.
  let result = isCharacterSniffable(str.charCodeAt(0)) ? '\\' : ''
  for (const char of str) {
    // By using `for..of`, we may receive a multi-code unit character.
    // These are never encoded, since the HTTP client handles it
    // automatically.
    result += char.length > 1 ? char : encodeCharacter(char)
  }
  return result
}

function encodeCharacter(char: string): string {
  const charCode = char.charCodeAt(0)
  if (charCode > 127) {
    // Non-ASCII characters are never encoded, since the HTTP client
    // handles it automatically.
    return char
  }
  switch (charCode) {
    case 32: // space
      return '+'
    case 35: // hash
    case 37: // percent
    case 38: // ampersand
    case 43: // plus
      return encodeURIComponent(char)
    case 40: // opening parenthesis
    case 41: // closing parenthesis
    case 44: // comma
    case 58: // colon
    case 123: // opening curly bracket
    case 125: // closing curly bracket
      return '\\' + char
  }
  return char
}
