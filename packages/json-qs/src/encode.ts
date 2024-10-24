import { isArray } from 'radashi'
import { KEY_RESERVED_CHARS, keyReservedCharEncoder } from './reserved.js'
import { CodableObject, CodableValue } from './types.js'

const alwaysTrue = () => true

export type EncodeOptions = {
  skippedKeys?: string[]
  /**
   * Called when a string is encountered for a parameter value. Return
   * falsy to use `encodeURIComponent` instead of the default encoding.
   */
  shouldEncodeString?: (key: string) => boolean
}

export function encode(obj: CodableObject, options?: EncodeOptions): string {
  return encodeProperties(
    obj,
    '&',
    '=',
    encodeURIComponent,
    options?.shouldEncodeString,
    options?.skippedKeys
  )
}

function encodeProperties(
  obj: CodableObject,
  separator: string,
  delimiter: string,
  encodeKey: (key: string) => string,
  shouldEncodeString: (key: string) => boolean = alwaysTrue,
  skippedKeys?: string[]
): string {
  let result = ''
  for (const key of Object.keys(obj).sort()) {
    if (skippedKeys?.includes(key)) {
      continue
    }
    if (obj[key] !== undefined) {
      result += `${result ? separator : ''}${encodeKey(key)}${delimiter}${typeof obj[key] !== 'string' || shouldEncodeString(key) ? encodeValue(obj[key]) : encodeURIComponent(obj[key])}`
    }
  }
  return result
}

function encodeValue(value: CodableValue): string {
  if (value === null || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'number') {
    return String(value).replace('e+', 'e')
  }
  if (typeof value === 'string') {
    return encodeString(value)
  }
  if (typeof value === 'bigint') {
    return String(value) + 'n'
  }
  if (isArray(value)) {
    return encodeArray(value)
  }
  if (typeof value === 'object') {
    return encodeObject(value)
  }
  throw new Error(`Unsupported value type: ${typeof value}`)
}

function encodeArray(value: readonly CodableValue[]): string {
  let result = ''
  for (let i = 0; i < value.length; i++) {
    result += `${i !== 0 ? ',' : ''}${value[i] !== undefined ? encodeValue(value[i]) : i !== value.length - 1 ? '' : ','}`
  }
  return `(${result})`
}

function encodeObjectKey(key: string): string {
  if (key === '') {
    return '~0'
  }
  if (KEY_RESERVED_CHARS.test(key)) {
    key = key.replace(KEY_RESERVED_CHARS, char => keyReservedCharEncoder[char])
  }
  return encodeURIComponent(key)
}

function encodeObject(obj: CodableObject): string {
  return `(${encodeProperties(obj, ',', ':', encodeObjectKey) || ':'})`
}

function encodeString(str: string): string {
  let result = ''
  for (const char of str) {
    result += encodeCharacter(char)
  }
  return `'${result}'`
}

function encodeCharacter(char: string): string {
  if (Number.isNaN(char.charCodeAt(1))) {
    const charCode = char.charCodeAt(0)
    if (charCode > 127) {
      // Accented letters, Chinese, Japanese, etc.
      return encodeURIComponent(char)
    }
    switch (charCode) {
      case 32: // space
        return '+'
      case 35: // hash
        return '%23'
      case 37: // percent sign
        return '%25'
      case 38: // ampersand
        return '%26'
      case 39: // apostrophe
        return "''"
      case 43: // plus
        return '%2B'
    }
    return char
  }
  // Since we use `for..of` to iterate over the string, a character might
  // contain multiple code units. In this case, it's obviously a non-ASCII
  // character, so we need to encode it.
  return encodeURIComponent(char)
}
