# alien-query-string

This specification defines how to encode JSON objects into query strings without percent-encoding. A primary goal is to keep the implementation minimal. Another primary goal is to keep the query string human-readable.

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
a=(b=0)
```

Property names are always percent-encoded.

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
a=(b=1,c=2)
```

## Encoding Strings

The following string…

```js
{
  a: '(b=0)'
}
```

…is encoded into the following query string:

```
a='(b=0)'
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

#### Arrays vs objects

_“How do you differentiate between an array and an object if both use parentheses?”_

Good question. The array's first element is parsed as if it's a property name until one of these characters is encountered:

- equals sign `=`
- percent sign `%`
- comma `,`
- opening parenthesis `(`
- closing parenthesis `)`

When `=` or `%` is found first, the entire block is treated as an object.

#### Empty arrays

An empty array is encoded as `()`, while an empty object is encoded as `(=)`.

## Encoding `undefined`

Undefined values are ignored everywhere except in arrays, where they're encoded as nothing.

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

## Encoding Bigints

Bigints are simply stringified with a `n` suffix.

The following object…

```js
{
  a: 123n
}
```

…is encoded into the following query string:

```
a=123n
```

## Everything Else

Any types not addressed above are not encoded.

This includes the following types:

- boolean
- number (including NaN and ±Infinity)
- bigint
- null
