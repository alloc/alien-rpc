type DynamicPath = {
  parser: RegExp
  index: number
  /**
   * The offset to use when matching the path. This is only needed when the
   * matched prefix is longer than the prefix of this path.
   */
  offset?: number
}

export type PathMatcher = <TArgs extends any[] = any[], TResult = any>(
  path: string,
  callback: (
    index: number,
    params: Record<string, string>,
    ...args: TArgs
  ) => TResult | undefined,
  ...args: TArgs
) => TResult | undefined

/**
 * Given a list of unsorted path patterns, returns a function that can be
 * used to match a path against the list efficiently.
 *
 * The given callback receives the index of the path pattern and the parsed
 * parameters.
 */
export function compilePaths(paths: string[]): PathMatcher {
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
      const parser = tokensToRegex(tokens)
      const maxSlashes = detectMaximumSlashes(tokens)

      // Ensure the exact prefix has an array to push to.
      dynamicPaths[prefix] ??= []

      // Iterate the existing prefixes to find any that are compatible. Since
      // longer prefixes are processed first, this loop will add the current
      // path to all compatible prefixes.
      for (const otherPrefix in dynamicPaths) {
        if (!otherPrefix.startsWith(prefix)) {
          continue
        }
        // Check for an exact match.
        if (prefix.length === otherPrefix.length) {
          dynamicPaths[prefix].push({ parser, index })
        }
        // If there aren't too many slashes, use this prefix.
        else if (countSlashes(otherPrefix) <= maxSlashes) {
          dynamicPaths[otherPrefix].push({
            parser,
            index,
            offset: prefix.length,
          })
        }
      }
    }
  }

  // The keys of the dynamicPaths object are sorted longest to shortest, so this
  // regex will match the longest prefix.
  const dynamicPrefixRE =
    Object.keys(dynamicPaths).length > 0
      ? new RegExp(
          '^(?:' +
            Object.keys(dynamicPaths).map(escapeRegexChars).join('|') +
            ')'
        )
      : null

  function matchFixedPath(
    path: string,
    callback: (
      index: number,
      params: Record<string, string>,
      ...args: any[]
    ) => any,
    ...args: any[]
  ) {
    const fixedMatches = fixedPaths[path]
    if (fixedMatches) {
      return iterateUntilResult(fixedMatches, index =>
        callback(index, {}, ...args)
      )
    }
  }

  function matchDynamicPath(
    path: string,
    callback: (
      index: number,
      params: Record<string, string>,
      ...args: any[]
    ) => any,
    ...args: any[]
  ) {
    const prefixMatch = dynamicPrefixRE?.exec(path)
    if (prefixMatch) {
      const prefix = prefixMatch[0]
      return iterateUntilResult(
        dynamicPaths[prefix],
        ({ parser, index, offset }) => {
          parser.lastIndex = offset ?? prefix.length

          // V8 has a fast path for RegExp.test, so prefer it over exec.
          if (parser.test(path)) {
            return callback(index, parser.exec(path)!.groups ?? {}, ...args)
          }
        }
      )
    }
  }

  const matchers = [matchFixedPath, matchDynamicPath]

  return (path, callback, ...args) => {
    return iterateUntilResult(matchers, matcher =>
      matcher(path, callback, ...args)
    )
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
          pattern = '[\\S\\s]*?'
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

function detectMaximumSlashes(tokens: string[]) {
  let maxSlashes = 0
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      maxSlashes += countSlashes(tokens[i])
    } else if (tokens[i].charCodeAt(0) === CharCode.Asterisk) {
      return Infinity
    }
  }
  return maxSlashes
}

function iterateUntilResult<TItem, TResult>(
  array: TItem[],
  callback: (item: TItem) => TResult | undefined,
  index = 0
): TResult | undefined {
  if (index >= array.length) {
    return undefined
  }

  const result = callback(array[index])

  if (result === undefined) {
    return iterateUntilResult(array, callback, index + 1)
  }

  if (result instanceof Promise) {
    return result.then(value => {
      if (value === undefined) {
        return iterateUntilResult(array, callback, index + 1)
      }
      return value
    }) as any
  }

  return result
}
