# empath

Type-safe route paths for TypeScript.

#### Path patterns

- **Fixed routes** `/foo`  
  Only matches `/foo` and takes precedence over all other patterns.

- **Named parameters** `/foo/:bar`  
  Matches `/foo/123` but not `/foo/123/456`.

- **Catch-all parameters** `/foo/*bar`  
  Matches any path starting with `/foo/` but not `/foo`.

- **Unnamed catch-all parameters** `/foo/*`  
  Matches any path starting with `/foo/` but the tail isn't included in the
  parsed parameter values.

#### API

### parsePathParams

Returns an array of parameter names in the path.

### sortPaths

Sorts an array of paths by specificity.

### compilePaths

Compiles an array of paths into a function that matches a path to an index in the array.

### buildPath

Turns a path and a params object into a string.

Note: Parameter types are not validated.

#### Types

### InferParams

Derive an object type from a path pattern.

### PathTemplate

Create a template literal type from a path pattern.
