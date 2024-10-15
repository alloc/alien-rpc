/**
 * Encode a string into another string.
 */
type Encode = (value: string) => string;
/**
 * Decode a string into another string.
 */
type Decode = (value: string) => string;
interface ParseOptions {
    /**
     * A function for encoding input strings.
     */
    encodePath?: Encode;
}
interface PathToRegexpOptions {
    /**
     * Matches the path completely without trailing characters. (default: `true`)
     */
    end?: boolean;
    /**
     * Allows optional trailing delimiter to match. (default: `true`)
     */
    trailing?: boolean;
    /**
     * Match will be case sensitive. (default: `false`)
     */
    sensitive?: boolean;
    /**
     * The default delimiter for segments. (default: `'/'`)
     */
    delimiter?: string;
}
interface MatchOptions extends PathToRegexpOptions {
    /**
     * Function for decoding strings for params, or `false` to disable entirely. (default: `decodeURIComponent`)
     */
    decode?: Decode | false;
}
interface CompileOptions {
    /**
     * Function for encoding input strings for output into the path, or `false` to disable entirely. (default: `encodeURIComponent`)
     */
    encode?: Encode | false;
    /**
     * The default delimiter for segments. (default: `'/'`)
     */
    delimiter?: string;
}
/**
 * Plain text.
 */
interface Text {
    type: "text";
    value: string;
}
/**
 * A parameter designed to match arbitrary text within a segment.
 */
interface Parameter {
    type: "param";
    name: string;
}
/**
 * A wildcard parameter designed to match multiple segments.
 */
interface Wildcard {
    type: "wildcard";
    name: string;
}
/**
 * A set of possible tokens to expand when matching.
 */
interface Group {
    type: "group";
    tokens: Token[];
}
/**
 * A token that corresponds with a regexp capture.
 */
type Key = Parameter | Wildcard;
/**
 * A sequence of `path-to-regexp` keys that match capturing groups.
 */
type Keys = Array<Key>;
/**
 * A sequence of path match characters.
 */
type Token = Text | Parameter | Wildcard | Group;
/**
 * Tokenized path instance.
 */
declare class TokenData {
    readonly tokens: Token[];
    constructor(tokens: Token[]);
}
/**
 * Parse a string for the raw tokens.
 */
declare function parse(str: string, options?: ParseOptions): TokenData;
/**
 * Compile a string to a template function for the path.
 */
declare function compile<P extends ParamData = ParamData>(path: Path, options?: CompileOptions & ParseOptions): (params?: P) => string;
type ParamData = Partial<Record<string, string | string[]>>;
type PathFunction<P extends ParamData> = (data?: P) => string;
/**
 * A match result contains data about the path match.
 */
interface MatchResult<P extends ParamData> {
    path: string;
    params: P;
}
/**
 * A match is either `false` (no match) or a match result.
 */
type Match<P extends ParamData> = false | MatchResult<P>;
/**
 * The match function takes a string and returns whether it matched the path.
 */
type MatchFunction<P extends ParamData> = (path: string) => Match<P>;
/**
 * Supported path types.
 */
type Path = string | TokenData;
/**
 * Transform a path into a match function.
 */
declare function match<P extends ParamData>(path: Path | Path[], options?: MatchOptions & ParseOptions): MatchFunction<P>;
declare function pathToRegexp(path: Path | Path[], options?: PathToRegexpOptions & ParseOptions): {
    regexp: RegExp;
    keys: Keys;
};
/**
 * Stringify token data into a path string.
 */
declare function stringify(data: TokenData): string;

export { type CompileOptions, type Decode, type Encode, type Group, type Key, type Keys, type Match, type MatchFunction, type MatchOptions, type MatchResult, type ParamData, type Parameter, type ParseOptions, type Path, type PathFunction, type PathToRegexpOptions, type Text, type Token, TokenData, type Wildcard, compile, match, parse, pathToRegexp, stringify };
