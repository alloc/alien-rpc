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
