import { Project } from '@ts-morph/bootstrap'
import { FileUtils, type ts } from '@ts-morph/common'
import { JumpgenFS } from 'jumpgen'
import path from 'node:path'
import {
  Directory,
  ResolvedModuleWithFailedLookupLocations,
  Store,
} from '../generator-types.js'
import { typeConstraints } from '../type-constraints.js'
import * as TypeBoxCodegen from '../typebox-codegen/index.js'

export type CompilerAPI = typeof import('@ts-morph/common').ts

export type TypeScriptWrap = ReturnType<typeof wrapTypeScriptModule>

export function wrapTypeScriptModule(
  ts: CompilerAPI,
  fs: JumpgenFS,
  store: Store,
  isWatchMode: boolean
) {
  function watchMissingImport(
    sourceFile: ts.SourceFile,
    specifier: string,
    compilerOptions: ts.CompilerOptions,
    moduleResolutionHost: ts.ModuleResolutionHost
  ) {
    const { failedLookupLocations, affectingLocations } = ts.resolveModuleName(
      specifier,
      sourceFile.fileName,
      compilerOptions,
      moduleResolutionHost
    ) as unknown as {
      failedLookupLocations: string[]
      affectingLocations?: string[]
    }

    const watchPaths = [
      ...(failedLookupLocations ?? []),
      ...(affectingLocations ?? []),
    ]

    if (watchPaths.length > 0) {
      fs.watch(watchPaths, {
        cause: sourceFile.fileName,
      })
    }
  }

  function shouldIgnoreImportSpecifier(filePath: string) {
    return filePath.startsWith('@sinclair/typebox')
  }

  function resolveDependencies(
    sourceFile: ts.SourceFile,
    compilerOptions: ts.CompilerOptions,
    moduleResolutionHost: ts.ModuleResolutionHost,
    project: Project,
    onResolve: (
      resolvedModule: ts.ResolvedModuleFull | undefined,
      affectingLocations: string[] | undefined,
      sourceFile: ts.SourceFile
    ) => void,
    onDirectory: (directory: Directory) => void
  ): void {
    const directoryPath = FileUtils.getStandardizedAbsolutePath(
      project.fileSystem,
      path.dirname(sourceFile.fileName)
    )

    let directory: Directory | undefined

    // Use a private API to get the referenced modules.
    const imports = ((sourceFile as any).imports ?? []) as ts.StringLiteral[]

    for (const specifier of imports) {
      if (shouldIgnoreImportSpecifier(specifier.text)) {
        continue
      }

      if (!directory) {
        directory = store.directories.get(directoryPath)
        if (!directory)
          store.directories.set(
            directoryPath,
            (directory = {
              files: new Set(),
              resolutionCache: new Map(),
              seenSpecifiers: new Set(),
              tsConfig: store.tsConfigCache.findUp(directoryPath),
            })
          )
      }

      let resolution = directory.resolutionCache.get(specifier.text)

      if (!directory.seenSpecifiers.has(specifier.text)) {
        directory.seenSpecifiers.add(specifier.text)

        if (resolution) {
          const resolvedFileName = resolution.resolvedModule?.resolvedFileName

          // If the specifier could not be resolved in a previous run, we
          // must look again.
          if (!resolvedFileName) {
            resolution = undefined
          }
          // If the resolved file was deleted, we must look again.
          else if (store.deletedFiles.has(resolvedFileName)) {
            resolution = undefined
          }
        }
      }

      if (!resolution) {
        resolution = ts.resolveModuleName(
          specifier.text,
          sourceFile.fileName,
          directory.tsConfig?.compilerOptions ?? compilerOptions,
          moduleResolutionHost
        ) as ResolvedModuleWithFailedLookupLocations

        directory.resolutionCache.set(specifier.text, resolution)
      }

      // Note: We *could* watch `resolution.failedLookupLocations` but the
      // memory cost may not be worth it (and I'm too lazy to see if that's
      // true), so let's just do less to be safe.
      onResolve(
        resolution.resolvedModule,
        resolution.affectingLocations,
        sourceFile
      )
    }

    // The directory won't exist if no imports needed resolution.
    if (directory) {
      directory.files.add(sourceFile)
      onDirectory(directory)
    }
  }

  function collectDependencies(
    rootSourceFile: ts.SourceFile,
    compilerOptions: ts.CompilerOptions,
    moduleResolutionHost: ts.ModuleResolutionHost,
    project: Project
  ): void {
    const seen = new Set<ts.SourceFile>()
    descend(rootSourceFile)

    function descend(sourceFile: ts.SourceFile) {
      if (seen.has(sourceFile)) {
        return
      }

      seen.add(sourceFile)
      store.includedFiles.add(sourceFile)

      resolveDependencies(
        sourceFile,
        compilerOptions,
        moduleResolutionHost,
        project,
        (resolvedModule, affectingLocations) => {
          // Any files we find are watched, but their changes must be
          // attributed to the `rootSourceFile` so the route-containing
          // source files can be re-analyzed.
          if (isWatchMode) {
            if (resolvedModule) {
              const resolvedPath = resolvedModule.resolvedFileName

              fs.watch(resolvedPath, {
                cause: rootSourceFile.fileName,
              })

              // An original path will exist if the import resolved to a symlink.
              // In that case, originalPath is the symlink location.
              const originalPath = (resolvedModule as any).originalPath
              if (originalPath) {
                fs.watch(originalPath, {
                  cause: rootSourceFile.fileName,
                })
              }
            }

            if (affectingLocations) {
              fs.watch(affectingLocations, {
                cause: rootSourceFile.fileName,
              })
            }
          }

          if (resolvedModule) {
            descend(
              project.addSourceFileAtPathSync(resolvedModule.resolvedFileName)
            )
          }
        },
        directory => {
          // If a directory's tsconfig was used to resolve an import, watch
          // it and invalidate the rootSourceFile if it changes.
          if (isWatchMode && directory.tsConfig) {
            fs.watch(directory.tsConfig.fileName, {
              cause: rootSourceFile.fileName,
            })
          }
        }
      )
    }
  }

  function parseTypeLiteral(type: string) {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      `type Temp = ${type}`,
      ts.ScriptTarget.Latest
    )
    return (sourceFile.statements[0] as ts.TypeAliasDeclaration).type
  }

  /**
   * Check if every property in an object literal type is optional.
   */
  function arePropertiesOptional(objectLiteralType: string): boolean {
    if (objectLiteralType === 'Record<string, never>') {
      return true
    }
    const typeNode = parseTypeLiteral(objectLiteralType)
    if (ts.isTypeLiteralNode(typeNode)) {
      return typeNode.members.every(member => {
        if (ts.isPropertySignature(member)) {
          return member.questionToken !== undefined
        }
        return false
      })
    }
    return false
  }

  /**
   * Check if a route's path parameters need a runtime validator.
   */
  function needsPathSchema(type: string) {
    const typeNode = parseTypeLiteral(type)
    if (!ts.isTypeLiteralNode(typeNode)) {
      throw new Error('Expected a type literal')
    }
    for (const member of typeNode.members) {
      if (!ts.isPropertySignature(member)) {
        throw new Error('Expected a property signature')
      }
      const memberType = member.type
      if (!memberType || memberType.kind !== ts.SyntaxKind.StringKeyword) {
        return true
      }
    }
    return false
  }

  /**
   * Generate a runtime validator for a TypeScript type.
   */
  async function generateRuntimeValidator(code: string) {
    const generatedCode = TypeBoxCodegen.generateTypes(ts, code, {
      emitConstOnly: true,
      includeTypeBoxImport: false,
      typeTags: typeConstraints,
    })

    const sourceFile = ts.createSourceFile(
      'validator.ts',
      generatedCode,
      ts.ScriptTarget.Latest,
      true
    )

    const constStatement = sourceFile.statements.find(
      (statement): statement is ts.VariableStatement =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.length === 1 &&
        statement.declarationList.declarations[0].initializer !== undefined
    )

    if (constStatement) {
      const initializer =
        constStatement.declarationList.declarations[0].initializer
      if (initializer) {
        return initializer.getText()
      }
    }

    throw new Error('Failed to parse TypeBox validator')
  }

  async function generateServerTypeAliases(
    clientTypeAliases: string,
    typeConstraints: string[]
  ) {
    return TypeBoxCodegen.generateTypes(ts, clientTypeAliases, {
      emitConstOnly: true,
      includeTypeBoxImport: false,
      typeTags: typeConstraints,
    })
  }

  return {
    ...ts,
    watchMissingImport,
    collectDependencies,
    arePropertiesOptional,
    needsPathSchema,
    generateRuntimeValidator,
    generateServerTypeAliases,
  }
}
