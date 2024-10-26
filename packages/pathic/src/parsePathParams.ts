/**
 * Collect all parameter names in a path.
 */
export function parsePathParams(path: string) {
  return Array.from(path.matchAll(/(?<=\/[:*])(\w+)/g), ([, name]) => name)
}
