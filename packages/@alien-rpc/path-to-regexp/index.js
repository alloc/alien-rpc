// src/index.ts
var DEFAULT_DELIMITER = "/";
var NOOP_VALUE = (value) => value;
var ID_START = /^[$_\p{ID_Start}]$/u;
var ID_CONTINUE = /^[$\u200c\u200d\p{ID_Continue}]$/u;
var DEBUG_URL = "https://git.new/pathToRegexpError";
var SIMPLE_TOKENS = {
  // Groups.
  "{": "{",
  "}": "}",
  // Reserved.
  "(": "(",
  ")": ")",
  "[": "[",
  "]": "]",
  "+": "+",
  "?": "?",
  "!": "!"
};
function escapeText(str) {
  return str.replace(/[{}()\[\]+?!:*]/g, "\\$&");
}
function escape(str) {
  return str.replace(/[.+*?^${}()[\]|/\\]/g, "\\$&");
}
function* lexer(str) {
  const chars = [...str];
  let i = 0;
  function name() {
    let value = "";
    if (ID_START.test(chars[++i])) {
      value += chars[i];
      while (ID_CONTINUE.test(chars[++i])) {
        value += chars[i];
      }
    } else if (chars[i] === '"') {
      let pos = i;
      while (i < chars.length) {
        if (chars[++i] === '"') {
          i++;
          pos = 0;
          break;
        }
        if (chars[i] === "\\") {
          value += chars[++i];
        } else {
          value += chars[i];
        }
      }
      if (pos) {
        throw new TypeError(`Unterminated quote at ${pos}: ${DEBUG_URL}`);
      }
    }
    if (!value) {
      throw new TypeError(`Missing parameter name at ${i}: ${DEBUG_URL}`);
    }
    return value;
  }
  while (i < chars.length) {
    const value = chars[i];
    const type = SIMPLE_TOKENS[value];
    if (type) {
      yield { type, index: i++, value };
    } else if (value === "\\") {
      yield { type: "ESCAPED", index: i++, value: chars[i++] };
    } else if (value === ":") {
      const value2 = name();
      yield { type: "PARAM", index: i, value: value2 };
    } else if (value === "*") {
      const value2 = name();
      yield { type: "WILDCARD", index: i, value: value2 };
    } else {
      yield { type: "CHAR", index: i, value: chars[i++] };
    }
  }
  return { type: "END", index: i, value: "" };
}
var Iter = class {
  constructor(tokens) {
    this.tokens = tokens;
  }
  peek() {
    if (!this._peek) {
      const next = this.tokens.next();
      this._peek = next.value;
    }
    return this._peek;
  }
  tryConsume(type) {
    const token = this.peek();
    if (token.type !== type) return;
    this._peek = void 0;
    return token.value;
  }
  consume(type) {
    const value = this.tryConsume(type);
    if (value !== void 0) return value;
    const { type: nextType, index } = this.peek();
    throw new TypeError(
      `Unexpected ${nextType} at ${index}, expected ${type}: ${DEBUG_URL}`
    );
  }
  text() {
    let result = "";
    let value;
    while (value = this.tryConsume("CHAR") || this.tryConsume("ESCAPED")) {
      result += value;
    }
    return result;
  }
};
var TokenData = class {
  constructor(tokens) {
    this.tokens = tokens;
  }
  toFunction(delimiter, encode) {
    return tokensToFunction(this.tokens, delimiter, encode);
  }
};
function parse(str, options = {}) {
  const { encodePath = NOOP_VALUE } = options;
  const it = new Iter(lexer(str));
  function consume(endType) {
    const tokens2 = [];
    while (true) {
      const path = it.text();
      if (path) tokens2.push({ type: "text", value: encodePath(path) });
      const param = it.tryConsume("PARAM");
      if (param) {
        tokens2.push({
          type: "param",
          name: param
        });
        continue;
      }
      const wildcard = it.tryConsume("WILDCARD");
      if (wildcard) {
        tokens2.push({
          type: "wildcard",
          name: wildcard
        });
        continue;
      }
      const open = it.tryConsume("{");
      if (open) {
        tokens2.push({
          type: "group",
          tokens: consume("}")
        });
        continue;
      }
      it.consume(endType);
      return tokens2;
    }
  }
  const tokens = consume("END");
  return new TokenData(tokens);
}
function compile(path, options = {}) {
  const { encode = encodeURIComponent, delimiter = DEFAULT_DELIMITER } = options;
  const data = path instanceof TokenData ? path : parse(path, options);
  const fn = tokensToFunction(data.tokens, delimiter, encode);
  return function path2(params = {}) {
    const [path3, ...missing] = fn(params);
    if (missing.length) {
      throw new TypeError(`Missing parameters: ${missing.join(", ")}`);
    }
    return path3;
  };
}
function tokensToFunction(tokens, delimiter, encode) {
  const encoders = tokens.map(
    (token) => tokenToFunction(token, delimiter, encode)
  );
  return (data) => {
    const result = [""];
    for (const encoder of encoders) {
      const [value, ...extras] = encoder(data);
      result[0] += value;
      result.push(...extras);
    }
    return result;
  };
}
function tokenToFunction(token, delimiter, encode) {
  if (token.type === "text") return () => [token.value];
  if (token.type === "group") {
    const fn = tokensToFunction(token.tokens, delimiter, encode);
    return (data) => {
      const [value, ...missing] = fn(data);
      if (!missing.length) return [value];
      return [""];
    };
  }
  const encodeValue = encode || NOOP_VALUE;
  if (token.type === "wildcard" && encode !== false) {
    return (data) => {
      const value = data[token.name];
      if (value == null) return ["", token.name];
      if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError(`Expected "${token.name}" to be a non-empty array`);
      }
      return [
        value.map((value2, index) => {
          if (typeof value2 !== "string") {
            throw new TypeError(
              `Expected "${token.name}/${index}" to be a string`
            );
          }
          return encodeValue(value2);
        }).join(delimiter)
      ];
    };
  }
  return (data) => {
    const value = data[token.name];
    if (value == null) return ["", token.name];
    if (typeof value !== "string") {
      throw new TypeError(`Expected "${token.name}" to be a string`);
    }
    return [encodeValue(value)];
  };
}
function match(path, options = {}) {
  const { decode = decodeURIComponent, delimiter = DEFAULT_DELIMITER } = options;
  const { regexp, keys } = pathToRegexp(path, options);
  const decoders = keys.map((key) => {
    if (decode === false) return NOOP_VALUE;
    if (key.type === "param") return decode;
    return (value) => value.split(delimiter).map(decode);
  });
  return function match2(input) {
    const m = regexp.exec(input);
    if (!m) return false;
    const path2 = m[0];
    const params = /* @__PURE__ */ Object.create(null);
    for (let i = 1; i < m.length; i++) {
      if (m[i] === void 0) continue;
      const key = keys[i - 1];
      const decoder = decoders[i - 1];
      params[key.name] = decoder(m[i]);
    }
    return { path: path2, params };
  };
}
function pathToRegexp(path, options = {}) {
  const {
    delimiter = DEFAULT_DELIMITER,
    end = true,
    sensitive = false,
    trailing = true
  } = options;
  const keys = [];
  const sources = [];
  const flags = sensitive ? "" : "i";
  for (const seq of flat(path, options)) {
    sources.push(toRegExp(seq, delimiter, keys));
  }
  let pattern = `^(?:${sources.join("|")})`;
  if (trailing) pattern += `(?:${escape(delimiter)}$)?`;
  pattern += end ? "$" : `(?=${escape(delimiter)}|$)`;
  const regexp = new RegExp(pattern, flags);
  return { regexp, keys };
}
function* flat(path, options) {
  if (Array.isArray(path)) {
    for (const p of path) yield* flat(p, options);
    return;
  }
  const data = path instanceof TokenData ? path : parse(path, options);
  yield* flatten(data.tokens, 0, []);
}
function* flatten(tokens, index, init) {
  if (index === tokens.length) {
    return yield init;
  }
  const token = tokens[index];
  if (token.type === "group") {
    for (const seq of flatten(token.tokens, 0, init.slice())) {
      yield* flatten(tokens, index + 1, seq);
    }
  } else {
    init.push(token);
  }
  yield* flatten(tokens, index + 1, init);
}
function toRegExp(tokens, delimiter, keys) {
  let result = "";
  let backtrack = "";
  let isSafeSegmentParam = true;
  for (const token of tokens) {
    if (token.type === "text") {
      result += escape(token.value);
      backtrack += token.value;
      isSafeSegmentParam || (isSafeSegmentParam = token.value.includes(delimiter));
      continue;
    }
    if (token.type === "param" || token.type === "wildcard") {
      if (!isSafeSegmentParam && !backtrack) {
        throw new TypeError(`Missing text after "${token.name}": ${DEBUG_URL}`);
      }
      if (token.type === "param") {
        result += `(${negate(delimiter, isSafeSegmentParam ? "" : backtrack)}+)`;
      } else {
        result += `([\\s\\S]+)`;
      }
      keys.push(token);
      backtrack = "";
      isSafeSegmentParam = false;
      continue;
    }
  }
  return result;
}
function negate(delimiter, backtrack) {
  if (backtrack.length < 2) {
    if (delimiter.length < 2) return `[^${escape(delimiter + backtrack)}]`;
    return `(?:(?!${escape(delimiter)})[^${escape(backtrack)}])`;
  }
  if (delimiter.length < 2) {
    return `(?:(?!${escape(backtrack)})[^${escape(delimiter)}])`;
  }
  return `(?:(?!${escape(backtrack)}|${escape(delimiter)})[\\s\\S])`;
}
function stringify(data) {
  return data.tokens.map(function stringifyToken(token, index, tokens) {
    if (token.type === "text") return escapeText(token.value);
    if (token.type === "group") {
      return `{${token.tokens.map(stringifyToken).join("")}}`;
    }
    const isSafe = isNameSafe(token.name) && isNextNameSafe(tokens[index + 1]);
    const key = isSafe ? token.name : JSON.stringify(token.name);
    if (token.type === "param") return `:${key}`;
    if (token.type === "wildcard") return `*${key}`;
    throw new TypeError(`Unexpected token: ${token}`);
  }).join("");
}
function isNameSafe(name) {
  const [first, ...rest] = name;
  if (!ID_START.test(first)) return false;
  return rest.every((char) => ID_CONTINUE.test(char));
}
function isNextNameSafe(token) {
  if (!token || token.type !== "text") return true;
  return !ID_CONTINUE.test(token.value[0]);
}
export {
  TokenData,
  compile,
  match,
  parse,
  pathToRegexp,
  stringify
};
