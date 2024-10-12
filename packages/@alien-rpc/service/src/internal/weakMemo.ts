export function weakMemo<K extends object, V extends {}>(
  factory: (key: K) => V
) {
  const cache = new WeakMap<K, V>()
  return (key: K) => {
    let value = cache.get(key)
    if (value === undefined) {
      value = factory(key)
      cache.set(key, value)
    }
    return value
  }
}
