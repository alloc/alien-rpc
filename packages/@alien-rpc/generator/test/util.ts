import fs from 'node:fs'
import path from 'node:path'
import { isArray, isFunction } from 'radashi'

export function recursiveRead(
  dir: string,
  files: Record<string, string> = {},
  root = dir
): Record<string, string> {
  fs.readdirSync(dir).forEach(name => {
    if (name === '.') return

    const file = path.join(dir, name)
    const stat = fs.statSync(file)

    if (stat.isDirectory()) {
      recursiveRead(file, files, root)
    } else {
      const key = path.relative(root, file)
      files[key] = fs.readFileSync(file, 'utf8')
    }
  })
  return files
}

/**
 * Remove indentation from a string. The given string is expected to
 * be consistently indented (i.e. the leading whitespace of the first
 * non-empty line is the minimum required for all non-empty lines).
 *
 * If the `indent` argument is nullish, the indentation is detected
 * from the first non-empty line. Detection is cheap and robust for
 * most use cases, so you should only set an explicit `indent` if
 * necessary.
 *
 * @see https://radashi.js.org/reference/string/dedent
 * @example
 * ```ts
 * // This is indented with 4 spaces.
 * const input = `
 *     Hello
 *     World
 * `
 *
 * // Explicit indentation
 * dedent(input, '  ')
 * // => '  Hello\n  World\n'
 *
 * // Detected indentation
 * dedent(input)
 * // => 'Hello\nWorld\n'
 *
 * // Tagged template strings
 * const str = dedent`
 *   Foo ${1 + 1}
 *   Bar ${2 * 2}
 * `
 * // => 'Foo 2\nBar 4'
 * ```
 */
export function dedent(
  template: TemplateStringsArray,
  ...values: unknown[]
): string

export function dedent(text: string, indent?: string | null): string

export function dedent(
  text: string | TemplateStringsArray,
  ...values: unknown[]
): string {
  // Support tagged template strings
  if (isArray(text)) {
    if (values.length > 0) {
      return dedent(
        text.reduce((acc, input, i) => {
          let value = String(values[i] ?? '')

          // Detect the indentation before this embedded string.
          const indent =
            value.includes('\n') && input.match(/\n([ \t]*)(?=[^\n]*$)/)?.[1]

          // Ensure the multi-line, embedded string can be correctly
          // dedented.
          if (indent) {
            value = value.replace(/\n(?=[^\n]*?\S)/g, '\n' + indent)
          }

          return acc + input + value
        }, '')
      )
    }

    text = text[0]
  }

  const indent = values[0] ?? detectIndent(text)
  const output = indent
    ? text.replace(new RegExp(`^${indent}`, 'gm'), '')
    : text

  // Remove the first and last lines (if empty).
  return output.replace(/^[ \t]*\n|\n[ \t]*$/g, '')
}

// Find the indentation of the first non-empty line.
function detectIndent(text: string) {
  return text.match(/^[ \t]*(?=\S)/m)?.[0]
}

type Fn = (...args: any[]) => any

export function prefer<T>(
  ...prefs: (Exclude<T, Fn> | ((value: T) => boolean))[]
) {
  return (a: T, b: T): number => {
    for (const pref of prefs) {
      if (isFunction(pref)) {
        if (pref(a)) return -1
        if (pref(b)) return 1
      } else {
        if (Object.is(a, pref)) return -1
        if (Object.is(b, pref)) return 1
      }
    }
    return 0
  }
}
