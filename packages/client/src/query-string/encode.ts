type CodableObject = { [key: string]: CodableValue }

type CodableValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | CodableObject
  | readonly CodableValue[]

export type EncodeOptions = {
  /**
   * Called when a string is encountered for a direct property value.
   * Return falsy to use `encodeURIComponent` instead of the default
   * encoding.
   */
  shouldEncodeString?: (key: string) => boolean
}

export function encode(obj: CodableObject, options?: EncodeOptions): string {
  return encodeProperties(obj, '&', options)
}

const alwaysTrue = () => true

function encodeProperties(
  obj: CodableObject,
  separator: string,
  options?: EncodeOptions
): string {
  const shouldEncodeString = options?.shouldEncodeString ?? alwaysTrue
  let result = ''
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) {
      result += `${result ? separator : ''}${encodeURIComponent(key)}=${typeof obj[key] !== 'string' || shouldEncodeString(key) ? encodeValue(obj[key]) : encodeURIComponent(obj[key])}`
    }
  }
  return result
}

function encodeValue(value: CodableValue): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return String(value)
  }
  if (typeof value === 'string') {
    return encodeString(value)
  }
  if (typeof value === 'bigint') {
    return String(value) + 'n'
  }
  if (Array.isArray(value)) {
    return encodeArray(value)
  }
  if (typeof value === 'object') {
    return encodeObject(value)
  }
  throw new Error(`Unsupported value type: ${typeof value}`)
}

function encodeArray(value: CodableArray): string {
  let result = ''
  for (let i = 0; i < value.length; i++) {
    result += `${i > 0 ? ',' : ''}${value[i] !== undefined ? encodeValue(value[i]) : ''}`
  }
  return `(${result})`
}

function encodeObject(obj: CodableObject): string {
  return `(${encodeProperties(obj, ',') || '='})`
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
    const code = char.charCodeAt(0)
    if (code > 127) {
      // Accented letters, Chinese, Japanese, etc.
      return encodeURIComponent(char)
    }
    switch (code) {
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
