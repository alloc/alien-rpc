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

export type DecodeOptions = {
  /**
   * Called when a string value is encountered.
   * Return falsy to use `decodeURIComponent` instead of the default
   * decoding.
   */
  shouldDecodeString?: (key: string) => boolean
}

const cursor = { pos: 0 }

export function decode(
  input: URLSearchParams,
  options?: DecodeOptions
): CodableObject {
  const shouldDecodeString = options?.shouldDecodeString ?? alwaysTrue
  const result: CodableObject = {}
  input.forEach((value, key) => {
    if (shouldDecodeString(key)) {
      cursor.pos = 0
      result[key] = parseValue(value)
    } else {
      result[key] = value
    }
  })
  return result
}

const alwaysTrue = () => true

function parseProperties(
  str: string,
  separator: string,
  options?: DecodeOptions
): CodableObject {
  const shouldDecodeString = options?.shouldDecodeString ?? alwaysTrue
  const result: CodableObject = {}

  let current = ''
  let key: string | null = null
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (inString) {
      if (char === "'" && !escaped) {
        inString = false
      }
      escaped = char === "'" && !escaped
      current += char
    } else if (char === "'") {
      inString = true
      escaped = false
      current += char
    } else if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (char === '=' && key === null && depth === 0) {
      key = decodeURIComponent(current)
      if (!key) {
        throw new Error('Empty key is not allowed')
      }
      current = ''
    } else if (char === separator && depth === 0) {
      if (key === null) {
        throw new Error(`Invalid key-value pair: ${current}`)
      }
      result[key] =
        typeof current === 'string' && !shouldDecodeString(key)
          ? decodeURIComponent(current)
          : parseValue(current)
      key = null
      current = ''
    } else {
      current += char
    }
  }

  // Handle the last pair
  if (key !== null) {
    result[key] =
      typeof current === 'string' && !shouldDecodeString(key)
        ? decodeURIComponent(current)
        : parseValue(current)
  } else if (current) {
    throw new Error(`Invalid key-value pair: ${current}`)
  }

  return result
}

function parseValue(str: string): CodableValue {
  if (!str) return null

  // Handle string literals
  if (str.startsWith("'")) {
    if (!str.endsWith("'")) {
      throw new Error(`Unterminated string literal: ${str}`)
    }
    return parseString(str.slice(1, -1))
  }

  // Handle arrays and objects
  if (str.startsWith('(')) {
    if (!str.endsWith(')')) {
      throw new Error(`Unterminated parentheses: ${str}`)
    }
    const content = str.slice(1, -1)

    // Empty array
    if (!content) return []

    // Empty object
    if (content === '=') return {}

    // Determine if it's an array or object by looking for an equals sign
    // before any unescaped comma
    let isObject = false
    let inString = false
    let escaped = false

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      if (inString) {
        if (char === "'" && !escaped) {
          inString = false
        }
        escaped = char === "'" && !escaped
      } else if (char === "'") {
        inString = true
        escaped = false
      } else if (char === '=' && !inString) {
        isObject = true
        break
      } else if (char === ',' && !inString) {
        break
      }
    }

    return isObject ? parseProperties(content, ',') : parseArray(content)
  }

  // Handle other literals
  if (str === 'null') return null
  if (str === 'true') return true
  if (str === 'false') return false
  if (str.endsWith('n')) {
    try {
      return BigInt(str.slice(0, -1))
    } catch {
      throw new Error(`Invalid BigInt literal: ${str}`)
    }
  }

  const num = Number(str)
  if (!Number.isNaN(num)) return num

  throw new Error(`Invalid value: ${str}`)
}

function parseArray(str: string): CodableValue[] {
  if (!str) return []

  const result: CodableValue[] = []
  let current = ''
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (inString) {
      if (char === "'" && !escaped) {
        inString = false
      }
      escaped = char === "'" && !escaped
      current += char
    } else if (char === "'") {
      inString = true
      escaped = false
      current += char
    } else if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (char === ',' && depth === 0) {
      result.push(current ? parseValue(current) : undefined)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current ? parseValue(current) : undefined)
  return result
}

function parseString(str: string): string {
  let result = ''
  let escaped = false

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (escaped) {
      if (char === "'") {
        result += "'"
      } else {
        throw new Error(`Invalid escape sequence: '${char}`)
      }
      escaped = false
    } else if (char === "'") {
      escaped = true
    } else if (char === '+') {
      result += ' '
    } else if (char === '%') {
      if (i + 2 >= str.length) {
        throw new Error('Incomplete percent encoding')
      }
      const hex = str.slice(i + 1, i + 3)
      const code = parseInt(hex, 16)
      if (Number.isNaN(code)) {
        throw new Error(`Invalid percent encoding: %${hex}`)
      }
      result += String.fromCharCode(code)
      i += 2
    } else {
      result += char
    }
  }

  if (escaped) {
    throw new Error('String ends with escape character')
  }

  return result
}
