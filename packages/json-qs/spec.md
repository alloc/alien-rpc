# Specification

For a kitchen sink example, see [Kitchen Sink](#kitchen-sink) at the bottom of this document.

## Encoding Objects

The following object…

```js
{
  a: {
    b: 0
  }
}
```

…is encoded into the following query string:

```
a=(b:0)
```

#### Property names

At the root level, property names are percent-encoded.

Nested property names are encoded using the following rules:

- An empty property name becomes `~0`.
- Some characters need replacement:
  - `~` becomes `~1`
  - `:` becomes `~2`
  - `(` becomes `~3`
  - `)` becomes `~4`
  - `,` becomes `~5`

Percent-encoding alone cannot be relied on, since the decoder is designed to work with strings already parsed by the `URLSearchParams` API.

#### Multiple properties

The following object…

```js
{ a: 0, b: 1 }
```

…is encoded into the following query string:

```
a=0&b=1
```

But if the object was nested in another…

```js
{ a: { b: 1, c: 2 } }
```

…then it would be encoded into the following query string:

```
a=(b:1,c:2)
```

#### Empty objects

An empty object is encoded as `(:)`.

## Encoding Strings

The following string…

```js
{
  a: '(b:0)'
}
```

…is encoded into the following query string:

```
a='(b:0)'
```

With strings, some characters must be percent-encoded:

- ampersands `&`
- percent signs `%`
- plus signs `+`
- non-ASCII characters

Additionally, the following characters are specially encoded:

- apostrophes `'` are escaped by doubling them
- spaces are encoded as `+`

## Encoding Arrays

The following array…

```js
{
  a: [0, 1]
}
```

…is encoded into the following query string:

```
a=(0,1)
```

#### Empty arrays

An empty array is encoded as `()`.

#### Arrays vs objects

_“How do you differentiate between an array and an object if both use parentheses?”_

Good question. Sometimes, the first character after the opening parenthesis is enough to differentiate between an array and an object. This is true for the following characters:

- `:` marks an empty object
- `)` marks an empty array
- `(` marks an array, since a nested array or object is implied
- `,` marks a sparse array

If none of those are found, check for a string literal, which marks an array.

Finally, if still unsure, look ahead for a colon, which marks an object. If no colon is found before a closing parenthesis or comma is found, then it's an array.

## Encoding `undefined`

Undefined values are ignored everywhere except in arrays, where they're encoded as holes, creating a sparse array.

The following array…

```js
{
  a: [0, undefined, 1]
}
```

…is encoded into the following query string:

```
a=(0,,1)
```

An extra comma is required for an undefined value at the end of an array.

```js
{
  a: [0, undefined],
  b: [0, , ]
}
```

…is encoded into the following query string:

```
a=(0,,)&b=(0,,)
```

## Encoding Bigints

Bigints are simply stringified with an `"n"` suffix.

The following object…

```js
{
  a: 9007199254740992n
}
```

…is encoded into the following query string:

```
a=9007199254740992n
```

## Everything Else

The remaining JSON types are merely stringified:

- boolean
- number
- null

Some non-JSON values are also supported:

- NaN
- ±Infinity

## Kitchen Sink

The following object…

```js
{
  object: { a: 0, b: 1 },
  array: [-0, -1],
  string: 'hello',
  fraction: 1.23,
  true: true,
  false: false,
  null: null,
  undefined: undefined,
  bigint: 9007199254740992n,
  nan: NaN,
  infinity: Infinity,
  negInfinity: -Infinity,
  sciNotation: 1e100,
  sparseArray: [undefined, 1, ,],
  nestedArray: [[0, 1], [2, 3]],
  objectInArray: [{ a: 0 }],
  emptyArray: [],
  emptyObject: {},
}
```

…is encoded into the following query string (formatted for readability):

```
object = (a:0,b:1)
& array = (0,-1)
& string = 'hello'
& fraction = 1.23
& true = true
& false = false
& null = null
& bigint = 9007199254740992n
& nan = NaN
& infinity = Infinity
& negInfinity = -Infinity
& sciNotation = 1e100
& sparseArray = (,1,,)
& nestedArray = ((0,1),(2,3))
& objectInArray = ((a:0))
& emptyArray = ()
& emptyObject = (:)
```

Note the lack of `undefined` in the output.
