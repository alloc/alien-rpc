# Specification

For a kitchen sink example, see [Kitchen Sink](#kitchen-sink) at the bottom of this document.

## Objects

The root object is unbounded, its properties are separated by ampersands (`&`), and its property names end with an equals sign (`=`).

The following object…

```js
{ a: 0, b: 1 }
```

…is encoded into the following query string:

```
a=0&b=1
```

#### Nested objects

Nested objects are bounded by curly braces (`{}`), their properties are separated by commas (`,`), and their property names end with a colon (`:`).

The following object…

```js
{
  a: { b: 0, c: 1 }
}
```

…is encoded into the following query string:

```
a={b:0,c:1}
```

#### Property names

At the root level, property names are percent-encoded, like any other query string. This ensures the `new URLSearchParams` constructor can parse the root object for you.

In nested objects, property names are encoded the same way strings are encoded. The only exception is related to numbers and the minus sign (`-`), which are never escaped in property names.

The following object…

```ts
{
  a: { 1: 2 }
}
```

…is encoded into the following query string:

```
a={1:2}
```

We don't quote property names, because it takes more space. Also, neither apostrophes nor double quotes are URI-safe unless percent-encoded (which we try to avoid).

#### Empty objects

An empty object is encoded as `{}`.

## Strings

Strings are not wrapped in quotes. If a string would lead to ambiguity, its characters may be escaped with a backslash (`\`) as required.

The following string…

```ts
{
  theme: 'dark'
}
```

…is encoded into the following query string:

```
theme=dark
```

#### Escaping

Since strings aren't wrapped in quotes, many characters require special handling.

For example, these characters are _always_ escaped with a backslash (`\`):

- curly braces
- parentheses
- commas
- colons

And these characters are escaped if they're the first character, since they would otherwise imply another data type:

- digits (if not escaped, implies a number)
- hyphens (if not escaped, implies a negative number)
- backslashes (if not escaped, implies an escape sequence)

The following object…

```js
{
  a: '{b:0}',
}
```

…is encoded into the following query string:

```
a=\{b:0\}
```

#### Percent-encoding

Some characters have special meaning in query strings, so they must be percent-encoded:

- ampersands `&`
- percent signs `%`
- plus signs `+`
- hash signs `#`

Note that while non-ASCII characters (e.g. accented letters, Chinese, Japanese, emojis, etc.) are not explicitly handled by this specification, they will be percent-encoded by the `fetch` API or similar.

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

## Unsupported Values

These values are coerced to `null` just like in JSON:

- NaN
- ±Infinity
- undefined (ignored by objects)

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
