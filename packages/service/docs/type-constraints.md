# Type Constraints

The “type tags” feature allows you to constrain a route's input data at runtime beyond what TypeScript can offer. The type tags are defined in the `t` namespace imported from `@alien-rpc/service`.

To use a type tag, intersect it with the base type of a route's parameter or request body. You may use multiple tags on a single value.

```ts
import { route, t } from '@alien-rpc/service'

const getUser = route.get(
  '/users/:id',
  async (id: number & t.MultipleOf<1> & t.Minimum<1>) => {
    // ...
  }
)
```

Note that you can use type aliases to avoid repeating yourself.

```ts
type PositiveInteger = number & t.MultipleOf<1> & t.Minimum<1>
```

&nbsp;

#### Array Constraints

## MinItems

Enforces a minimum number of elements in an array input.

For example, when requiring users to select at least 2 categories for their blog post: `categories: string[] & t.MinItems<2>`

## MaxItems

Enforces a maximum number of elements in an array input.

For example, when limiting users to selecting no more than 5 tags for their product listing: `tags: string[] & t.MaxItems<5>`

## UniqueItems

Ensures all elements in an array are unique (no duplicates).

For example, when ensuring a list of user IDs contains no duplicates in a bulk operation: `userIds: number[] & t.UniqueItems<true>`

&nbsp;

#### Date Constraints

## MinimumTimestamp

Enforces a minimum timestamp value for date inputs.

For example, when ensuring a birth date is not before 1900: `birthDate: Date & t.MinimumTimestamp<-2208988800000>` (Jan 1, 1900)

## MaximumTimestamp

Enforces a maximum timestamp value for date inputs.

For example, when ensuring an appointment date is not too far in the future: `appointmentDate: Date & t.MaximumTimestamp<1735689600000>` (Jan 1, 2025)

## ExclusiveMinimumTimestamp

Similar to [MinimumTimestamp](#minimumtimestamp) but excludes the minimum value itself.

For example, when ensuring a start date must be strictly after a specific date: `startDate: Date & t.ExclusiveMinimumTimestamp<1672531200000>` (Jan 1, 2023)

## ExclusiveMaximumTimestamp

Similar to [MaximumTimestamp](#maximumtimestamp) but excludes the maximum value itself.

For example, when ensuring an expiry date must be strictly before a specific date: `expiryDate: Date & t.ExclusiveMaximumTimestamp<1704067200000>` (Jan 1, 2024)

## MultipleOfTimestamp

Ensures a timestamp is a multiple of a specific value, useful for time slot alignment.

For example, when ensuring meeting start times align with 30-minute slots: `startTime: Date & t.MultipleOfTimestamp<1800000>` (30 minutes in milliseconds)

&nbsp;

#### Number Constraints

## Minimum

Enforces a minimum numeric value.

For example, when ensuring a product price is not negative: `price: number & t.Minimum<0>`

## Maximum

Enforces a maximum numeric value.

For example, when limiting the quantity of items in a shopping cart: `quantity: number & t.Maximum<100>`

## ExclusiveMinimum

Similar to [Minimum](#minimum) but excludes the minimum value itself.

For example, when requiring a positive score (excluding zero): `score: number & t.ExclusiveMinimum<0>`

## ExclusiveMaximum

Similar to [Maximum](#maximum) but excludes the maximum value itself.

For example, when requiring a temperature to stay below boiling point: `temperature: number & t.ExclusiveMaximum<100>`

## MultipleOf

Ensures a number is a multiple of a specific value.

For example, when ensuring product quantities are ordered in multiples of 5: `quantity: number & t.MultipleOf<5>`

&nbsp;

#### Object Constraints

## MinProperties

Enforces a minimum number of properties in an object.

For example, when requiring at least one field in a form update: `update: Record<string, unknown> & t.MinProperties<1>`

## MaxProperties

Enforces a maximum number of properties in an object.

For example, when limiting the number of custom fields in a form submission: `customFields: Record<string, string> & t.MaxProperties<10>`

## AdditionalProperties

Controls whether an object can have properties not defined in its type.

For example, when ensuring a user profile update only contains allowed fields like name and email: `profile: { name: string, email: string } & t.AdditionalProperties<false>`

&nbsp;

#### String Constraints

## MinLength

Enforces a minimum length for string inputs.

For example, when requiring passwords to be at least 8 characters: `password: string & t.MinLength<8>`

## MaxLength

Enforces a maximum length for string inputs.

For example, when limiting usernames to 20 characters: `username: string & t.MaxLength<20>`

## Pattern

Ensures a string matches a specific regular expression pattern.

For example, when validating phone numbers: `phone: string & t.Pattern<'^\\+[1-9]\\d{1,14}$'>`

## Format

Ensures a string conforms to a predefined format (like email, uri, etc).

For example, when validating email addresses: `email: string & t.Format<'email'>`

#### Custom formats

You may add your own custom formats by calling `addStringFormat`. The format validator can be a `RegExp` or a function that takes a string and returns a boolean.

```ts
import { addStringFormat } from '@alien-rpc/service/format'

addStringFormat('phone', /^(\+\d{1,3}|)\d{10}$/)
```

## ContentEncoding

Specifies the expected encoding of a string (like base64, binary). **Please note** this is only for documentation purposes and does not perform any validation.

For example, when handling base64-encoded image data: `imageData: string & t.ContentEncoding<'base64'>`

## ContentMediaType

Specifies the expected media type of a string's content. **Please note** this is only for documentation purposes and does not perform any validation.

For example, when accepting JSON strings: `jsonData: string & t.ContentMediaType<'application/json'>`
