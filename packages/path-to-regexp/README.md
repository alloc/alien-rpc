# @alien-rpc/path-to-regexp

This is a fork of [path-to-regexp](https://github.com/pillarjs/path-to-regexp) with a few changes:

- Targets ES2020 instead of ES2015
- Added `type: "module"` to the package.json
- Removed CommonJS support

## Development

This folder contains compiled code only. The reason for this is to avoid unnecessary re-compiling of this package, which changes infrequently. It also has some heavy-ish dependencies that we can do without.

For the source code, clone [this repository](https://github.com/alloc/path-to-regexp). When finished making changes, run `pnpm install` followed by `pnpm build` to build the package. Finally, copy the contents of its `dist` folder into this folder.
