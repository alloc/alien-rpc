/**
 * Build a path from a path pattern and an object.
 *
 * Param values can be anything, but only arrays are specially handled.
 * Arrays are joined with slash `/` characters. Everything else has its
 * `toString` method called implicitly.
 */
export function buildPath(pattern: string, params: {}) {
  let path = ''
  let lastIndex = 0

  for (
    let lexer = /(?<=\/)([:*])(\w+)?/g, match = lexer.exec(pattern);
    match !== null;
    match = lexer.exec(pattern)
  ) {
    const name = match[2] ?? '*'
    const value = name in params ? (params as any)[name] : undefined

    if (value === undefined) {
      throw new Error(`Missing parameter "${name}" in path "${pattern}"`)
    }

    path += pattern.slice(lastIndex, match.index) + stringifyParam(value)
    lastIndex = match.index + match[0].length
  }

  return path + pattern.slice(lastIndex)
}

function stringifyParam(value: unknown) {
  return Array.isArray(value) ? value.join('/') : value
}
