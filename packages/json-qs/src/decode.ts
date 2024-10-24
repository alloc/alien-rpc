/// <reference types="node" />
import { keyReservedCharDecoder } from './reserved.js'
import { CodableObject, CodableValue } from './types.js'

export function decode(input: URLSearchParams): CodableObject {
  const result: CodableObject = {}
  let key: string | undefined
  try {
    for (key of input.keys()) {
      result[key] = parse(input.get(key)!)
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
  ArrayOrObject,
  Array,
  Object,
  NumberOrBigint,
  String,
}

const toCharCode = (c: string) => c.charCodeAt(0)

const QUOTE = toCharCode("'"),
  OPEN_PAREN = toCharCode('('),
  CLOSE_PAREN = toCharCode(')'),
  DIGIT_MIN = toCharCode('0'),
  DIGIT_MAX = toCharCode('9'),
  MINUS = toCharCode('-'),
  COMMA = toCharCode(','),
  TILDE = toCharCode('~'),
  COLON = toCharCode(':'),
  LOWER_N = toCharCode('n'),
  LOWER_F = toCharCode('f'),
  LOWER_T = toCharCode('t'),
  UPPER_I = toCharCode('I'),
  UPPER_N = toCharCode('N')

const constantsMap: Record<string, CodableValue> = {
  null: null,
  false: false,
  true: true,
}

function parse(input: string, cursor = { pos: 0 }): CodableValue {
  const startPos = cursor.pos
  const nested = startPos > 0

  let mode: number = ValueMode.Unknown
  let result: CodableValue

  let pos = startPos
  let charCode = input.charCodeAt(pos)

  // Try to deduce the value type.
  switch (charCode) {
    case QUOTE:
      mode = ValueMode.String
      break
    case OPEN_PAREN:
      mode = ValueMode.ArrayOrObject
      break
    case MINUS:
    case UPPER_I:
    case UPPER_N:
      mode = ValueMode.NumberOrBigint
      break
    case LOWER_N:
    case LOWER_F:
    case LOWER_T: {
      const endPos = nested ? findEndPos(input, pos) : input.length
      result = constantsMap[input.slice(pos, endPos)]
      if (result === undefined) {
        throw new SyntaxError(`Unknown constant at position ${pos}`)
      }
      cursor.pos = endPos
      return result
    }
  }
  if (mode === ValueMode.Unknown) {
    if (charCode >= DIGIT_MIN && charCode <= DIGIT_MAX) {
      mode = ValueMode.NumberOrBigint
    } else {
      throw new SyntaxError(
        startPos < input.length
          ? `Unexpected character '${input[startPos]}' at position ${startPos}`
          : `Unexpected end of input`
      )
    }
  }

  if (mode === ValueMode.ArrayOrObject) {
    pos += 1

    switch (input.charCodeAt(pos)) {
      case CLOSE_PAREN: // Empty array
        result = []
        break

      case COLON: // Empty object
        if (input.charCodeAt(pos + 1) !== CLOSE_PAREN) {
          throw new SyntaxError(`Expected ')' after ':' at position ${pos + 1}`)
        }
        result = {}
        break

      case OPEN_PAREN: // Nested array or object
      case COMMA: // Sparse array with empty first element
        mode = ValueMode.Array
        pos -= 1
        break

      // Either a string literal or a weird property name.
      case QUOTE:
        // The first condition checks for a possible escaped quote. If the
        // second condition fails, that's what it is. Otherwise, if a comma
        // is found, it's actually an empty string literal. When both
        // conditions pass, an array is implied.
        if (
          input.charCodeAt(pos + 1) !== QUOTE ||
          input.charCodeAt(pos + 2) === COMMA ||
          input.charCodeAt(pos + 2) === CLOSE_PAREN
        ) {
          mode = ValueMode.Array
          pos -= 1
          break
        }

      // At this point, we still don't know if it's an array or object, so
      // look for a colon as proof of an object.
      default: {
        const endPos = findEndPos(input, pos)
        const colonPos = findCharCode(input, pos, endPos, COLON)

        mode = colonPos >= 0 ? ValueMode.Object : ValueMode.Array
        pos -= 1
      }
    }
  }

  switch (mode) {
    case ValueMode.String: {
      let string = ''
      while (++pos < input.length) {
        if (input.charCodeAt(pos) === QUOTE) {
          pos += 1

          if (input.charCodeAt(pos) !== QUOTE) {
            result = string
            break
          }
        }
        string += input[pos]
      }
      break
    }

    case ValueMode.NumberOrBigint: {
      pos = nested ? findEndPos(input, pos + 1) : input.length
      if (input.charCodeAt(pos - 1) === LOWER_N) {
        result = BigInt(input.slice(startPos, pos - 1))
      } else {
        const slice = input.slice(startPos, pos)
        result = Number(slice)
        if (Number.isNaN(result) && slice !== 'NaN') {
          throw new SyntaxError(`Invalid number at position ${startPos}`)
        }
      }
      break
    }

    case ValueMode.Array: {
      const array: CodableValue[] = []

      while (++pos < input.length) {
        if (input.charCodeAt(pos) === COMMA) {
          array.push(undefined)
          if (input.charCodeAt(pos + 1) === CLOSE_PAREN) {
            pos += 1
          } else {
            continue
          }
        } else {
          cursor.pos = pos
          array.push(parse(input, cursor))
          pos = cursor.pos
        }

        if (input.charCodeAt(pos) === CLOSE_PAREN) {
          pos += 1
          result = array
          break
        }
      }
      break
    }

    case ValueMode.Object: {
      const object: CodableObject = {}
      let key = ''

      while (++pos < input.length) {
        charCode = input.charCodeAt(pos)

        if (charCode === COLON) {
          cursor.pos = pos + 1
          object[key] = parse(input, cursor)
          pos = cursor.pos

          if (input.charCodeAt(pos) === CLOSE_PAREN) {
            pos += 1
            result = object
            break
          }

          key = ''
          continue
        }

        if (charCode === QUOTE) {
          if (input.charCodeAt(pos + 1) !== QUOTE) {
            throw new SyntaxError(`Unexpected quote at position ${pos}`)
          }
          pos += 1
          key += "'"
          continue
        }

        if (charCode === TILDE) {
          const decodedChar = keyReservedCharDecoder[input[pos + 1]]
          if (decodedChar === undefined) {
            throw new SyntaxError(
              `Unexpected character '${input[pos + 1]}' at position ${pos + 1}`
            )
          }
          pos += 1
          key += decodedChar
          continue
        }

        key += input[pos]
      }
      break
    }
  }

  if (result === undefined) {
    throw new SyntaxError(`Unterminated input from position ${startPos}`)
  }

  // At this point, the `pos` variable is assumed to be one character past
  // the last character of the parsed value.
  cursor.pos = pos

  return result
}

function isEndChar(charCode: number) {
  return charCode === COMMA || charCode === CLOSE_PAREN
}

/**
 * Find the next comma or closing parenthesis.
 */
function findEndPos(input: string, startPos: number) {
  for (let pos = startPos; pos < input.length; pos++) {
    if (isEndChar(input.charCodeAt(pos))) {
      return pos
    }
  }
  throw new SyntaxError(`Unterminated input from position ${startPos}`)
}

/**
 * Search the characters between `startPos` and `endPos` for the given
 * character code. The `endPos` is exclusive, so it's not included in the
 * search.
 */
function findCharCode(
  input: string,
  startPos: number,
  endPos: number,
  charCode: number
) {
  const direction = startPos < endPos ? 1 : -1
  for (let pos = startPos; pos !== endPos; pos += direction) {
    if (input.charCodeAt(pos) === charCode) {
      return pos
    }
  }
  return -1
}
