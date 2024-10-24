# Specification

For a kitchen sink example, see [Kitchen Sink](#kitchen-sink) at the bottom of this document.

## Objects

The root object is unbounded, its properties are separated by ampersands (`&`), and its property names end with an equals sign (`=`).

Nested objects are bounded by curly braces (`{}`), their properties are separated by commas (`,`), and their property names end with a colon (`:`).

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
a={b:0}
```

#### Property names

At the root level, property names are percent-encoded.

In nested objects, property names are encoded as strings if they contain any of the following characters: `:`, `(`, `)`, `,`, or `'`.

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

But if an object is nested in another object…

```js
{ a: { b: 1, c: 2 } }
```

…then it would be encoded into the following query string:

```
a={b:1,c:2}
```

#### Empty objects

An empty object is encoded as `{}`.

## Strings

The following string…

```js
{
  a: '{b:0}'
}
```

…is encoded into the following query string:

```
a=\{b:0\}
```

Some characters have special meaning in query strings, so they must be percent-encoded:

- ampersands `&`
- percent signs `%`
- plus signs `+`
- hash signs `#`

Note that while non-ASCII characters (e.g. accented letters, Chinese, Japanese, emojis, etc.) are not explicitly handled by this specification, they will be percent-encoded by the `fetch` API or similar.

Since strings aren't wrapped in quotes, many characters require special handling.

Other characters are _always_ escaped with a backslash (`\`):

- curly braces
- parentheses
- commas
- colons

Finally, these characters are escaped if they are the first character in a string:

- digits (implying a number)
- hyphens (implying a negative number)
- backslashes (implying an escape sequence)

#### Empty strings

An empty string is encoded as nothing.

## Arrays

Arrays are bounded by parentheses `()` and their elements are separated by commas `,`.

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

#### Why use parentheses and not square brackets?

While square brackets are more aligned with the JSON syntax, using them here would require escaping square brackets in JSON paths, because we don't wrap string values with quotes or some other delimiter.

We've decided it's better for readability if JSON paths aren't littered with escapes as often.

#### Empty arrays

An empty array is encoded as `()`.

## Undefined Values

Like in JSON, undefined values are ignored in objects.

```ts
{
  a: undefined,
  b: 2,
}
```

…is encoded into the following query string:

```
b=2
```

#### Arrays with undefined values

Like in JSON, undefined values are coerced to `null` in arrays.

```js
{
  a: [undefined]
}
```

…is encoded into the following query string:

```
a=(null)
```

## Bigints

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
  infinity: Infinity,
  nan: NaN,
  bigint: 9007199254740992n,
  sciNotation: 1e100,
  sparseArray: [,,],
  nestedArray: [[0, 1], [2, 3]],
  objectInArray: [{ a: 0 }],
  emptyArray: [],
  emptyObject: {},
}
```

…is encoded into the following query string (formatted for readability):

```
object={a:0,b:1}
&array=(0,-1)
&string=hello
&fraction=1.23
&true=true
&false=false
&null=null
&infinity=null
&nan=null
&bigint=9007199254740992n
&sciNotation=1e100
&sparseArray=(null,null)
&nestedArray=((0,1),(2,3))
&objectInArray=({a:0})
&emptyArray=()
&emptyObject={}
```

Note the lack of `undefined` in the output.
