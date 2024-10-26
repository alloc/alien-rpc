export type PathMatcher<TResult> = (path: string) => TResult | undefined

/**
 * Given a list of unsorted path patterns, returns a function that can be
 * used to match a path against the list efficiently.
 *
 * The given callback receives the index of the path pattern and the parsed
 * parameters.
 */
export function compilePaths<TResult>(
  paths: string[],
  callback: (
    index: number,
    params: Record<string, string>
  ) => TResult | undefined
): PathMatcher<TResult> {
  type DynamicPath = readonly [parser: RegExp, index: number, prefix?: string]

  const fixedPaths: Record<string, number[]> = Object.create(null)
  const dynamicPaths: Record<string, DynamicPath[]> = Object.create(null)

  const sortedPaths = paths
    .map((path, index) => ({ index, tokens: lex(path) }))
    .sort(comparePathTokens)

  for (const { index, tokens } of sortedPaths) {
    if (tokens.length === 1) {
      const path = tokens[0]
      if (path in fixedPaths) {
        fixedPaths[path].push(index)
      } else {
        fixedPaths[path] = [index]
      }
    } else {
      const prefix = tokens[0]
      for (const otherPrefix in dynamicPaths) {
        if (otherPrefix.startsWith(prefix)) {
          dynamicPaths[otherPrefix].push([
            tokensToRegex(tokens),
            index,
            otherPrefix.slice(prefix.length),
          ])
        }
      }
      if (!(prefix in dynamicPaths)) {
        dynamicPaths[prefix] = [[tokensToRegex(tokens), index]]
      }
    }
  }

  const dynamicPrefixRE =
    Object.keys(dynamicPaths).length > 0
      ? new RegExp(
          '^(?:' +
            Object.keys(dynamicPaths).map(escapeRegexChars).join('|') +
            ')'
        )
      : null

  console.dir(
    {
      sortedPaths,
      fixedPaths,
      dynamicPaths,
      dynamicPrefixRE,
    },
    { depth: null }
  )

  return path => {
    const fixedMatches = fixedPaths[path]
    if (fixedMatches) {
      const emptyParams = Object.freeze({})

      for (const index of fixedMatches) {
        const result = callback(index, emptyParams)

        if (result !== undefined) {
          return result
        }
      }
    }

    const dynamicPrefix = dynamicPrefixRE?.exec(path)
    if (dynamicPrefix) {
      const dynamicMatches = dynamicPaths[dynamicPrefix[0]]
      for (const [parser, index, pathPrefix] of dynamicMatches) {
        parser.lastIndex = dynamicPrefix[0].length
        const pathMatch = parser.exec(pathPrefix ? pathPrefix + path : path)

        if (pathMatch) {
          const result = callback(index, pathMatch.groups ?? {})

          if (result !== undefined) {
            return result
          }
        }
      }
    }
  }
}

const enum CharCode {
  Asterisk = 42,
  Slash = 47,
  Colon = 58,
}

/**
 * Split a path into tokens, where each token is either a static part or a
 * parameter.
 *
 * Every even index is a static part, while every odd index is a parameter.
 */
function lex(path: string) {
  const tokens: string[] = []

  let offset = 0
  while (offset < path.length) {
    const prefix = getPrefix(path, offset)
    tokens.push(prefix)
    offset += prefix.length

    if (offset === path.length) {
      break
    }

    const charCode = path.charCodeAt(offset)
    if (charCode === CharCode.Colon || charCode === CharCode.Asterisk) {
      const endOffset = path.indexOf('/', offset + 1)
      if (endOffset === -1) {
        tokens.push(path.slice(offset))
        break
      }
      tokens.push(path.slice(offset, endOffset))
      offset = endOffset
    }
  }

  return tokens
}

function getPrefix(path: string, fromOffset: number) {
  for (
    let offset = fromOffset, charCode: number;
    offset < path.length;
    offset++
  ) {
    charCode = path.charCodeAt(offset)
    if (charCode === CharCode.Colon || charCode === CharCode.Asterisk) {
      if (path.charCodeAt(offset - 1) === CharCode.Slash) {
        return path.slice(fromOffset, offset)
      }
    }
  }
  return path.slice(fromOffset)
}

/**
 * Note: The first static part is not included in the regex.
 */
function tokensToRegex(tokens: string[]) {
  return new RegExp(
    tokens
      .slice(1)
      .map((token, i) => {
        if (i % 2 === 1) {
          return escapeRegexChars(token)
        }
        if (token === '*') {
          return '.*?'
        }
        let pattern: string
        if (token[0] === ':') {
          pattern = '[^/]+?'
        } else {
          pattern = '.*?'
        }
        const name = token.slice(1)
        return `(?<${name}>${pattern})`
      })
      .join('') + '$',
    'g'
  )
}

/**
 * Escape characters with special meaning either inside or outside
 * character sets. Use a simple backslash escape when it’s always valid,
 * and a `\xnn` escape when the simpler form would be disallowed by Unicode
 * patterns’ stricter grammar.
 */
function escapeRegexChars(string: string) {
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

function comparePathTokens(a: { tokens: string[] }, b: { tokens: string[] }) {
  const minLength = Math.min(a.tokens.length, b.tokens.length)
  for (let i = 0; i < minLength; i++) {
    const isStaticPart = i % 2 === 0
    if (isStaticPart) {
      if (a.tokens[i] !== b.tokens[i]) {
        // Prefer static parts with more slashes.
        const match = countSlashes(b.tokens[i]) - countSlashes(a.tokens[i])
        if (match) {
          return match
        }
      }
    } else {
      // If one starts with a colon and the other doesn't, prefer the one
      // with the colon.
      const match = xor(
        a.tokens[i].charCodeAt(0),
        b.tokens[i].charCodeAt(0),
        CharCode.Colon
      )
      if (match) {
        return match
      }
    }
  }
  // If all else fails, prefer the shorter tokens array.
  return a.tokens.length - b.tokens.length
}

/**
 * A comparator that returns non-zero if `a` and `b` are different, but one
 * of them is equal to `value`.
 */
function xor<T>(a: T, b: T, value: T) {
  return a === value ? (b !== value ? -1 : 0) : b === value ? 1 : 0
}

function countSlashes(path: string) {
  let n = 0
  for (let i = 0; i < path.length; i++) {
    if (path.charCodeAt(i) === CharCode.Slash) {
      n++
      i++ // Assume double slashes are not possible.
    }
  }
  return n
}
