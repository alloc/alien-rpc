import type { Project } from '@ts-morph/bootstrap'
import type { ts } from '@ts-morph/common'
import type { AnalyzedFile } from './analyze-file.js'
import type { AnalyzedRoute } from './analyze-route.js'
import type { SupportingTypes } from './typescript/supporting-types.js'
import type {
  TsConfigCache,
  TsConfigResolution,
} from './typescript/tsconfig.js'
import type { TypeScriptWrap } from './typescript/wrap.js'

export type Options = {
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
}

export interface Store {
  tsConfigFilePath: string
  tsConfigCache: TsConfigCache
  ts: TypeScriptWrap
  project: Project
  types: SupportingTypes
  serviceModuleId: string
  clientModuleId: string
  /**
   * Files that were deleted since the last run.
   *
   * This is checked when resolving the module graph to determine if a
   * cached import resolution needs to be refreshed.
   */
  deletedFiles: Set<string>
  /**
   * Files that have been analyzed for route definitions.
   *
   * This is used as a cache to avoid re-analyzing files that haven't
   * changed.
   */
  analyzedFiles: Map<ts.SourceFile, AnalyzedFile>
  /**
   * Files that have been imported (directly or indirectly) by
   * route-containing modules.
   *
   * Only these files are watched for changes and have their diagnostics
   * reported. Note that this gets cleared on each run.
   */
  includedFiles: Set<ts.SourceFile>
  /**
   * A cache of resolved import specifiers.
   *
   * The first key is either a directory name (for relative imports) or a
   * `tsconfig.json` file path (for bare specifiers).
   *
   * The second key is the import specifier.
   */
  directories: Map<string, Directory>
}

export interface Directory {
  files: Set<ts.SourceFile>
  /**
   * Module resolution is shared between files in the same directory.
   */
  resolutionCache: Map<string, ResolvedModuleWithFailedLookupLocations>
  /**
   * This tracks which import specifiers have been encountered in files
   * within the directory. It's used to identify unused entries in the
   * resolution cache. It also helps us avoid re-resolving files more than
   * once per run.
   */
  seenSpecifiers: Set<string>
  tsConfig: TsConfigResolution | null
}

export interface ResolvedModuleWithFailedLookupLocations {
  readonly resolvedModule?: ts.ResolvedModuleFull
  readonly affectingLocations?: string[]
  readonly failedLookupLocations: string[]
}

export type Event =
  | { type: 'route'; route: AnalyzedRoute }
  | { type: 'info'; message: string | [string, ...any[]] }
