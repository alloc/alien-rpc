/**
 * Taken from https://github.com/scrollback/juri
 * @license MIT
 *
 *	Use of other URL-safe characters
 *
 *	.	Dot in strings
 *	_	Spaces in strings
 *
 *	-	Value: Start of negative number
 *		In numbers, negative exponent
 *		-- is false
 *		-* is -Infinity
 *		-+ is null
 *
 *	+	Value: Start of positive number
 *		In numbers, positive exponent
 *		++ is true
 *		+* is +Infinity
 *		+- is undefined
 *		+! is NaN
 *
 *	!	(unused)
 *	'	In strings, toggles base64-encoded-unicode mode
 *
 *	(	Opens objects and arrays
 *	)	Closes objects and arrays
 *
 *	,	Delimiter in objects and arrays
 *	:	Key/value separator in objects
 *
 *	*	In strings, dictionary lookup
 *	~	In strings, 1-byte escape sequence for common special chars
 */

const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$@',
  commonSpl = '\t\n\r!"#$%&\'()*+,-./:;<=>?@[]^_`{|}~'

function create(dictionary?: string[]) {
  let encMap: {
      [key: string]: string
    },
    decMap: {
      [key: string]: string
    },
    dictReg: RegExp

  if (Array.isArray(dictionary)) {
    dictionary.splice(64)
    encMap = {}
    decMap = {}

    dictionary.forEach(function (word) {
      let i: number
      for (i = 0; i < word.length; i++) {
        if (
          chars.indexOf(word[i]) !== -1 &&
          typeof decMap[word[i]] === 'undefined'
        ) {
          encMap[word] = word[i]
          decMap[word[i]] = word
          return
        }
      }
      for (i = 0; i < chars.length; i++) {
        if (typeof decMap[chars[i]] === 'undefined') {
          encMap[word] = chars[i]
          decMap[chars[i]] = word
          return
        }
      }
    })

    dictReg = new RegExp(
      dictionary
        .map(function (word) {
          return word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        })
        .join('|'),
      'g'
    )
  }

  function encodeInteger(t: number) {
    let s = ''
    while (t) {
      s = chars[t % 64] + s
      t = Math.floor(t / 64)
    }
    return s || '0'
  }

  function decodeInteger(s: string) {
    let t = 0,
      i: number

    for (i = s.length - 1; i >= 0; i--) {
      t += chars.indexOf(s[i]) * Math.pow(64, s.length - i - 1)
    }
    return t
  }

  function encodeString(s: string) {
    if (!s) {
      return "''"
    }

    if (dictionary) {
      s = s.replace(dictReg, function (m) {
        return encMap[m] + '*'
      })
    }

    return s.replace(
      /[^0-9a-zA-Z$@*]+([0-9a-zA-Z$@]\*[^0-9a-zA-Z$@]*)*/g,
      function (run) {
        let i: number,
          m: string,
          n: number | string,
          r = '',
          u = false

        for (i = 0; i < run.length; i++) {
          m = run[i]

          if (run[i + 1] === '*') {
            r += m + '*'
            i++
            continue
          }

          if (m === ' ') {
            r += '_'
          } else if (m === '.') {
            r += '.'
          } else if ((n = commonSpl.indexOf(m)) >= 0) {
            r += '~' + chars[n]
          } else {
            if (!u) {
              r += "'"
              u = true
            }
            n = encodeInteger(m.charCodeAt(0))
            r += ('000' + n).substr(-3)
          }
        }

        if (u) {
          r += "'"
        }
        return r
      }
    )
  }

  function decodeString(s: string) {
    if (s === "''") {
      return ''
    }

    s = s.replace(/[0-9a-zA-Z$@]\*/g, function (m) {
      return "'*" + decMap[m[0]] + "'"
    })

    return s
      .split("'")
      .map(function (run, j) {
        if (run[0] === '*') {
          return run.substr(1)
        }

        run = run.replace(/_/g, ' ').replace(/\~./g, function (m) {
          return commonSpl[decodeInteger(m[1])]
        })

        if (j % 2) {
          run = run.replace(/[0-9a-zA-Z$@]+/g, function (m) {
            let i: number,
              r = ''
            for (i = 0; i < m.length; i += 3) {
              r += String.fromCharCode(
                decodeInteger(m[i] + m[i + 1] + m[i + 2])
              )
            }
            return r
          })
        }

        return run
      })
      .join('')
  }

  function encodeNumber(value: number) {
    let s = '',
      parts: string | string[],
      sig: string,
      exp = 0

    s += value < 0 ? '-' : '+'

    parts = value.toString()
    if (value.toExponential().length < parts.length) {
      parts = value.toExponential()
    }

    parts = parts.split(/[eE]/g)
    if (parts[1]) {
      exp = parseInt(parts[1])
    }

    parts = parts[0].split('.')
    if (parts[1]) {
      exp -= parts[1].length
    }

    sig = parts[0] + (parts[1] || '')
    sig = sig.replace(/0+$/, function (m) {
      if (exp === 0 && m.length <= 2) {
        return m
      }
      exp += m.length
      return ''
    })

    s += encodeInteger(Math.abs(parseInt(sig))) || '0'

    if (exp) {
      s += (exp < 0 ? '-' : '+') + encodeInteger(Math.abs(exp))
    }

    return s
  }

  function decodeNumber(str: string) {
    let expSign = str.indexOf('-', 1) === -1 ? '+' : '-',
      parts = str.substr(1).split(/[\+\-]/)

    return parseFloat(
      str[0] +
        decodeInteger(parts[0]) +
        (parts[1] ? 'e' + expSign + decodeInteger(parts[1]) : '')
    )
  }

  function encodeCollection(
    value: any[] | Record<string, any>,
    qStr?: boolean
  ): string {
    let i: string | number,
      s: string[] = [],
      j: number,
      k: string[]

    if (Array.isArray(value)) {
      for (i = 0; i < value.length; i++) {
        s.push(encode(value[i]))
      }
    } else {
      k = Object.keys(value).sort()

      if (!k.length && !qStr) {
        s.push(':')
      }

      for (j = 0; j < k.length; j++) {
        i = k[j]
        if (typeof value[i] !== 'undefined') {
          s.push(encodeString(i) + (qStr ? '=' : ':') + encode(value[i]))
        }
      }
    }
    return qStr ? s.join('&') : '(' + s.join(',') + ')'
  }

  function decodeCollection(string: string) {
    let i: number,
      l: number,
      c: string,
      level: number,
      start: number,
      key: string | null,
      out: any,
      mode!: string | null

    function assert(condition: boolean) {
      if (condition) {
        return
      }

      throw new SyntaxError('Unexpected ' + c + ' at ' + i + ' in ' + string)
    }

    function terminate(expectedMode: string, preserve?: boolean) {
      mode = mode || expectedMode

      if (!out) {
        out = mode === 'key' ? {} : []
      }
      if (start === i) {
        return
      }

      if (mode === 'key') {
        key = decodeString(string.substring(start, i))
        mode = 'value'
      } else {
        if (Array.isArray(out)) {
          out.push(decode(string.substring(start, i)))
        } else {
          if (key) {
            out[key] = decode(string.substring(start, i))
            key = null
          }
          mode = 'key'
        }
      }
      start = i + (preserve ? 0 : 1)
    }

    level = 0
    start = 1
    for (i = 1, l = string.length; i < l; i++) {
      c = string[i]

      if (c === '(') {
        if (level === 0) {
          mode = null
        }
        level++
        continue
      }

      if (c === ')') {
        if (level === 0) {
          terminate('value')
        }
        level--
        continue
      }

      assert(level >= 0)
      if (level > 0) {
        continue
      }

      if (c === ':') {
        terminate('key')
        continue
      }
      if (c === ',') {
        terminate('value')
        continue
      }
      if (c === '+' || c === '-') {
        if (mode === 'literal') {
          continue
        }
        terminate('value', true)
        mode = 'literal'
        continue
      }
    }
    assert(level === -1)
    return out
  }

  function encode(value: any, qStr?: boolean) {
    switch (typeof value) {
      case 'object':
        if (value === null) {
          return '-+'
        }
        return encodeCollection(value, qStr)
      case 'string':
        return encodeString(value)
      case 'number':
        if (isNaN(value)) {
          return '+!'
        }
        if (value === +Infinity) {
          return '+*'
        }
        if (value === -Infinity) {
          return '-*'
        }
        return encodeNumber(value)
      case 'boolean':
        return value ? '++' : '--'
      case 'undefined':
        return '+-'
      default:
        return ''
    }
  }

  function decode(string: string) {
    switch (string[0]) {
      case '(':
        return decodeCollection(string)
      case '-':
        if (string[1] === '-') {
          return false
        }
        if (string[1] === '+') {
          return null
        }
        if (string[1] === '*') {
          return -Infinity
        }
        return decodeNumber(string)
      case '+':
        if (string[1] === '-') {
          return undefined
        }
        if (string[1] === '!') {
          return NaN
        }
        if (string[1] === '+') {
          return true
        }
        if (string[1] === '*') {
          return Infinity
        }
        return decodeNumber(string)
      default:
        return decodeString(string)
    }
  }

  return {
    create,
    encode,
    decode,
    encodeInteger,
    decodeInteger,
    encodeString,
    decodeString,
    encodeNumber,
    decodeNumber,
    encodeCollection,
    decodeCollection,
    encodeQString: (obj: Record<string, any>) => encode(obj, true),
    decodeQString: (str: string) =>
      decode('(' + str.replace(/=/g, ':').replace(/&/g, ',') + ')'),
  }
}

export const juri = create()
