/// <reference types="node" />
import { CodableObject, CodableValue } from './types.js'

export function decode(input: URLSearchParams): CodableObject {
  const result: CodableObject = {}
  let key: string | undefined
  try {
    for (key of input.keys()) {
      result[key] = decodeValue(input.get(key)!)
    }
  } catch (error: any) {
    if (key !== undefined) {
      error.message = `Failed to decode value for '${key}' key: ${error.message}`
    }
    throw error
  }
  return result
}

const enum ValueMode {
  Unknown,
  Array,
  Object,
  NumberOrBigint,
  String,
}

const toCharCode = (c: string) => c.charCodeAt(0)

const QUOTE = toCharCode("'"),
  OPEN_PAREN = toCharCode('('),
  CLOSE_PAREN = toCharCode(')'),
  OPEN_CURLY = toCharCode('{'),
  CLOSE_CURLY = toCharCode('}'),
  DIGIT_MIN = toCharCode('0'),
  DIGIT_MAX = toCharCode('9'),
  MINUS = toCharCode('-'),
  COMMA = toCharCode(','),
  COLON = toCharCode(':'),
  LOWER_N = toCharCode('n'),
  ESCAPE = toCharCode('\\')

const constantsMap: Record<string, CodableValue> = {
  null: null,
  false: false,
  true: true,
}

function decodeValue(input: string, cursor = { pos: 0 }): CodableValue {
  const startPos = cursor.pos
  const nested = startPos > 0

  let mode: number = ValueMode.Unknown
  let result: CodableValue

  let pos = startPos
  let charCode = input.charCodeAt(pos)
  let endPos: number | undefined

  // Try to deduce the value type.
  switch (charCode) {
    case QUOTE:
      mode = ValueMode.String
      break

    case OPEN_PAREN:
      mode = ValueMode.Array
      break

    case OPEN_CURLY:
      mode = ValueMode.Object
      break

    case MINUS:
      mode = ValueMode.NumberOrBigint
      break

    default:
      if (charCode >= DIGIT_MIN && charCode <= DIGIT_MAX) {
        mode = ValueMode.NumberOrBigint
      } else {
        endPos = nested ? findEndPos(input, pos) : input.length

        // Check for a constant.
        if (charCode !== ESCAPE && endPos > pos && endPos - pos <= 5) {
          result = constantsMap[input.slice(pos, endPos)]
          if (result !== undefined) {
            cursor.pos = endPos
            return result
          }
        }
        // Default to a string.
        mode = ValueMode.String
      }
  }

  switch (mode) {
    case ValueMode.String: {
      result = ''
      let open = true
      while (open && pos < input.length) {
        switch (input.charCodeAt(pos)) {
          case CLOSE_CURLY:
          case CLOSE_PAREN:
            if (!result) {
              throw new SyntaxError(
                `Unexpected end of string at position ${pos}`
              )
            }
          case COLON:
          case COMMA:
            open = false
            break

          case ESCAPE:
            pos += 1 // Skip the escape and append the next character.

          default:
            result += input[pos]
            pos += 1
        }
      }
      break
    }

    case ValueMode.NumberOrBigint: {
      pos = nested ? findEndPos(input, pos + 1) : input.length
      if (input.charCodeAt(pos - 1) === LOWER_N) {
        result = BigInt(input.slice(startPos, pos - 1))
      } else {
        result = Number(input.slice(startPos, pos))
        if (Number.isNaN(result)) {
          throw new SyntaxError(`Invalid number at position ${startPos}`)
        }
      }
      break
    }

    case ValueMode.Array: {
      const array: CodableValue[] = []

      while (++pos < input.length) {
        charCode = input.charCodeAt(pos)

        if (charCode === COMMA) {
          array.push('')
        } else if (charCode === CLOSE_PAREN) {
          pos += 2
          result = array
          break
        } else {
          cursor.pos = pos
          array.push(decodeValue(input, cursor))
          pos = cursor.pos

          if (input.charCodeAt(pos) === CLOSE_PAREN) {
            pos += 1
            result = array
            break
          }
        }
      }
      break
    }

    case ValueMode.Object: {
      result = {} as CodableObject
      let key = ''
      let open = true
      while (open && ++pos < input.length) {
        charCode = input.charCodeAt(pos)

        // Colon marks the end of a key and the beginning of a value.
        if (charCode === COLON) {
          cursor.pos = pos + 1
          result[key] = decodeValue(input, cursor)
          pos = cursor.pos
          key = ''

          // Skip past the comma that ended the value.
          charCode = input.charCodeAt(pos)
          if (charCode === COMMA) {
            continue
          }
        }

        switch (charCode) {
          case CLOSE_CURLY:
            if (key.length) {
              throw new SyntaxError(`Unterminated key at position ${pos}`)
            }
            open = false
            pos += 1
            break

          case COMMA:
            result[key] = key = ''
            break

          case ESCAPE:
            pos += 1 // Skip the escape and append the next character.

          default:
            key += input[pos]
        }
      }
      break
    }
  }

  if (result === undefined) {
    throw new SyntaxError(`Unterminated input from position ${startPos}`)
  }

  // At this point, the `pos` variable is assumed to be one character past
  // the last character of the decoded value.
  cursor.pos = pos

  return result
}

/**
 * Find the end of a value that is nested in an array or object.
 */
function findEndPos(input: string, startPos: number) {
  for (let pos = startPos; pos < input.length; pos++) {
    const charCode = input.charCodeAt(pos)
    if (
      charCode === COMMA ||
      charCode === CLOSE_PAREN ||
      charCode === CLOSE_CURLY
    ) {
      return pos
    }
  }
  throw new SyntaxError(`Unterminated input from position ${startPos}`)
}
