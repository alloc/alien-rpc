import type { ShallowOptions } from 'option-types'

export type UserConfig = ShallowOptions<{
  /**
   * Paths to modules that export route definitions. Glob patterns are
   * allowed. Negated glob patterns (e.g. `!foo`) are also supported.
   */
  include: string | string[]
  /**
   * Path to the `tsconfig.json` file. Relative to the root directory.
   *
   * @default "tsconfig.json"
   */
  tsConfigFile?: string
  /**
   * The directory to output the generated files.
   */
  outDir: string
  /**
   * @default 'server/generated/api.ts'
   */
  serverOutFile?: string
  /**
   * @default 'client/generated/api.ts'
   */
  clientOutFile?: string
  /**
   * Your API's current version. There is no convention for what this
   * should be, but using the release date (e.g. `2024-10-31`) or a
   * semantic major version (e.g. `v1` or `v2`) are popular choices. Note
   * that its value is prefixed to every route pathname, so `/foo` becomes
   * `/v1/foo`.
   *
   * If not defined, the API won't be versioned, which means breaking
   * changes to your API could break active sessions in your client
   * application.
   */
  versionPrefix?: string
  /**
   * When true, diagnostics for node_modules are printed to the console.
   *
   * @default false
   */
  verbose?: boolean
}>
