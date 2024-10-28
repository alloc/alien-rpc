import {
  StringContentEncodingOption,
  StringFormatOption,
} from '@sinclair/typebox'

/// Array Constraints

/** The minimum number of items in this array */
export declare class MinItems<T extends number> {
  _$minItems?: T
}
/** The maximum number of items in this array */
export declare class MaxItems<T extends number> {
  _$maxItems?: T
}
/** Should this schema contain unique items */
export declare class UniqueItems {
  _$uniqueItems?: true
}
/** A schema for which some elements should match */
export declare class Contains<T> {
  _$contains?: T
}
/** A minimum number of contains schema matches */
export declare class MinContains<T extends number> {
  _$minContains?: T
}
/** A maximum number of contains schema matches */
export declare class MaxContains<T extends number> {
  _$maxContains?: T
}

/// Date Constraints

/** The minimum timestamp */
export declare class MinimumTimestamp<T extends number> {
  _$minimumTimestamp?: T
}
/** The maximum timestamp */
export declare class MaximumTimestamp<T extends number> {
  _$maximumTimestamp?: T
}
/** The exclusive minimum timestamp */
export declare class ExclusiveMinimumTimestamp<T extends number> {
  _$exclusiveMinimumTimestamp?: T
}
/** The exclusive maximum timestamp */
export declare class ExclusiveMaximumTimestamp<T extends number> {
  _$exclusiveMaximumTimestamp?: T
}
/** The timestamp should be a multiple of this number */
export declare class MultipleOfTimestamp<T extends number> {
  _$multipleOfTimestamp?: T
}

/// Number Constraints

/** The minimum number */
export declare class Minimum<T extends number | bigint> {
  _$minimum?: T
}
/** The maximum number */
export declare class Maximum<T extends number | bigint> {
  _$maximum?: T
}
/** The exclusive minimum number */
export declare class ExclusiveMinimum<T extends number | bigint> {
  _$exclusiveMinimum?: T
}
/** The exclusive maximum number */
export declare class ExclusiveMaximum<T extends number | bigint> {
  _$exclusiveMaximum?: T
}
/** The number should be a multiple of this number */
export declare class MultipleOf<T extends number | bigint> {
  _$multipleOf?: T
}

/// Object Constraints

/** The minimum number of properties in this object */
export declare class MinProperties<T extends number> {
  _$minProperties?: T
}
/** The maximum number of properties in this object */
export declare class MaxProperties<T extends number> {
  _$maxProperties?: T
}

/// String Constraints

/** The maximum string length */
export declare class MinLength<T extends number> {
  _$minLength?: T
}
/** The minimum string length */
export declare class MaxLength<T extends number> {
  _$maxLength?: T
}
/** A regular expression pattern this string should match */
export declare class Pattern<T extends string> {
  _$pattern?: T
}
/** A format this string should match */
export declare class Format<T extends StringFormatOption> {
  _$format?: T
}
/** The content encoding for this string */
export declare class ContentEncoding<T extends StringContentEncodingOption> {
  _$contentEncoding?: T
}
/** The content media type for this string */
export declare class ContentMediaType<T extends string> {
  _$contentMediaType?: T
}
