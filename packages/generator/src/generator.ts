import { bodylessMethods } from '@alien-rpc/route'
import { createProject } from '@ts-morph/bootstrap'
import { FileUtils, injectTypeScriptModule, type ts } from '@ts-morph/common'
import createResolver from 'esm-resolve'
import { FileChange, jumpgen } from 'jumpgen'
import path from 'path'
import { parsePathParams } from 'pathic'
import { camel, guard, pascal, sift } from 'radashi'
import { analyzeFile } from './analyze-file.js'
import { reportDiagnostics } from './diagnostics.js'
import type { Event, Options, Store } from './generator-types.js'
import { typeConstraints } from './type-constraints.js'
import { createSupportingTypes } from './typescript/supporting-types.js'
import { createTsConfigCache } from './typescript/tsconfig.js'
import { wrapTypeScriptModule } from './typescript/wrap.js'

export default (rawOptions: Options) =>
  jumpgen<Store, Event, void>('alien-rpc', async context => {
    const { fs, root, store, emit, changes } = context

    const options = {
      ...rawOptions,
      outDir: path.resolve(root, rawOptions.outDir),
      serverOutFile: rawOptions.serverOutFile ?? 'server/generated/api.ts',
      clientOutFile: rawOptions.clientOutFile ?? 'client/generated/api.ts',
    } satisfies Options

    const entryFilePaths = fs.scan(options.include, {
      cwd: root,
      absolute: true,
    })

    if (!entryFilePaths.length) {
      throw new Error(
        `No files matching ${JSON.stringify(options.include)} were found in ${JSON.stringify(root)}`
      )
    }

    options.serverOutFile = path.resolve(options.outDir, options.serverOutFile)
    options.clientOutFile = path.resolve(options.outDir, options.clientOutFile)

    if (isProjectInvalidated(store, changes)) {
      const tsConfigFilePath = (store.tsConfigFilePath ??= path.resolve(
        root,
        options.tsConfigFile ?? 'tsconfig.json'
      ))

      // Find the "typescript" package installed in the project.
      const compilerPath = resolveModule('path', tsConfigFilePath, [
        'typescript',
      ])

      const ts = await import(compilerPath)
      store.ts = wrapTypeScriptModule(ts, fs, store, !!context.watcher)
      injectTypeScriptModule(ts)

      emit({
        type: 'info',
        message: ['Loaded typescript@%s from', ts.version, compilerPath],
      })

      store.project = await createProject({
        tsConfigFilePath,
        skipFileDependencyResolution: true,
      })

      store.serviceModuleId = resolveModule('id', options.serverOutFile, [
        'alien-rpc/service',
        '@alien-rpc/service',
      ])
      store.clientModuleId = resolveModule('id', options.clientOutFile, [
        'alien-rpc/client',
        '@alien-rpc/client',
      ])

      store.types = createSupportingTypes(
        store.ts,
        store.project,
        path.dirname(tsConfigFilePath),
        store.serviceModuleId
      )

      store.tsConfigCache = createTsConfigCache(fs, store.project)

      store.deletedFiles = new Set()
      store.analyzedFiles = new Map()
      store.includedFiles = new Set()
      store.directories = new Map()
    } else {
      store.types.clear()
      store.deletedFiles.clear()
      store.includedFiles.clear()
      store.directories.forEach(directory => {
        directory.seenSpecifiers.clear()
      })

      for (const change of changes) {
        const affectedFilePath = path.join(root, change.file)

        if (change.event === 'add') {
          store.project.createSourceFile(
            affectedFilePath,
            fs.read(affectedFilePath, 'utf8')
          )
        } else {
          const tsConfig = store.tsConfigCache.get(affectedFilePath)
          if (tsConfig) {
            store.tsConfigCache.invalidate(affectedFilePath)
            continue
          }

          const affectedSourceFile =
            store.project.getSourceFile(affectedFilePath)

          if (affectedSourceFile) {
            store.analyzedFiles.delete(affectedSourceFile)

            if (change.event === 'unlink') {
              const directoryPath = path.dirname(affectedSourceFile.fileName)
              const directory = store.directories.get(directoryPath)
              if (
                directory?.files.delete(affectedSourceFile) &&
                directory.files.size === 0
              ) {
                store.directories.delete(directoryPath)
              }
              store.deletedFiles.add(affectedFilePath)
              store.project.removeSourceFile(affectedFilePath)
            } else {
              store.project.updateSourceFile(
                affectedFilePath,
                fs.read(affectedFilePath, 'utf8')
              )
            }
          }
        }
      }
    }

    const { ts, project, types, analyzedFiles, includedFiles } = store

    project.resolveSourceFileDependencies()

    const program = project.createProgram()
    const typeChecker = program.getTypeChecker()
    const compilerOptions = program.getCompilerOptions()
    const moduleResolutionHost = project.getModuleResolutionHost()
    const referencedTypes = new Map<ts.Symbol, string>()

    const routes = project
      .getSourceFiles()
      .filter(sourceFile => entryFilePaths.includes(sourceFile.fileName))
      .flatMap(sourceFile => {
        let metadata = analyzedFiles.get(sourceFile)
        if (!metadata) {
          metadata = analyzeFile(ts, sourceFile, typeChecker, types)
          analyzedFiles.set(sourceFile, metadata)

          // Prepend the API version to all route pathnames.
          if (options.versionPrefix) {
            for (const route of metadata.routes) {
              route.resolvedPathname = `/${options.versionPrefix}${route.resolvedPathname}`
            }
          }

          for (const route of metadata.routes) {
            emit({ type: 'route', route })
          }
        }
        ts.collectDependencies(
          sourceFile,
          compilerOptions,
          moduleResolutionHost,
          project
        )
        for (const [symbol, type] of metadata.referencedTypes) {
          referencedTypes.set(symbol, type)
        }
        return metadata.routes
      })

    // After we've traversed the module graph, we can clean up the
    // resolution cache.
    store.directories.forEach(directory => {
      for (const specifier of directory.resolutionCache.keys()) {
        if (!directory.seenSpecifiers.has(specifier)) {
          directory.resolutionCache.delete(specifier)
        }
      }
    })

    if (!routes.length) {
      throw new Error('No routes were exported by the included files')
    }

    reportDiagnostics(ts, program, {
      verbose: options.verbose,
      ignoreFile: file => !includedFiles.has(file),
      onModuleNotFound: (specifier, importer) =>
        context.watcher &&
        ts.watchMissingImport(
          importer,
          specifier,
          compilerOptions,
          moduleResolutionHost
        ),
    })

    const clientDefinitions: string[] = []
    const clientTypeImports = new Set<string>(['RequestOptions', 'Route'])
    const clientFormats = new Set<string>()

    const serverDefinitions: string[] = []
    const serverImports = new Set<string>()
    const serverCheckedStringFormats = new Set<string>()

    const serverTsConfig = store.tsConfigCache.findUp(
      FileUtils.getStandardizedAbsolutePath(
        project.fileSystem,
        path.dirname(options.serverOutFile)
      )
    )!

    for (const route of routes) {
      let pathSchemaDecl = ''
      let requestSchemaDecl = ''

      if (
        route.resolvedPathParams &&
        ts.needsPathSchema(route.resolvedPathParams)
      ) {
        pathSchemaDecl = (
          await ts.generateRuntimeValidator(
            `type Path = ${route.resolvedPathParams}`
          )
        ).replace(/\bType\.(Number|Array)\(/g, (match, type) => {
          switch (type) {
            case 'Number':
              serverImports.add('NumberParam')
              return 'NumberParam('
            case 'Array':
              serverImports.add('ArrayParam')
              return 'ArrayParam('
          }
          return match
        })
      }

      const dataArgument =
        route.resolvedArguments[route.resolvedPathParams ? 1 : 0]

      if (dataArgument && dataArgument !== 'any') {
        requestSchemaDecl = await ts.generateRuntimeValidator(
          `type Request = ${dataArgument}`
        )

        if (!bodylessMethods.has(route.resolvedMethod)) {
          requestSchemaDecl = requestSchemaDecl.replace(
            /\bType\.(Date)\(/g,
            (match, type) => {
              switch (type) {
                case 'Date':
                  serverImports.add('DateString')
                  return 'DateString('
              }
              return match
            }
          )
        }
      }

      const responseSchemaDecl =
        route.resolvedFormat === 'response'
          ? `Type.Any()`
          : await ts.generateRuntimeValidator(
              `type Response = ${route.resolvedResult}`
            )

      for (const match of (
        pathSchemaDecl +
        requestSchemaDecl +
        responseSchemaDecl
      ).matchAll(/Type\.String\(.*?format:\s*['"](\w+)['"].*?\)/g)) {
        serverCheckedStringFormats.add(match[1])
      }

      const handlerPath = resolveImportPath(
        options.serverOutFile,
        route.fileName,
        serverTsConfig.compilerOptions.allowImportingTsExtensions
      )

      const pathParams = parsePathParams(route.resolvedPathname)

      const sharedProperties = [
        `method: "${route.resolvedMethod}"`,
        pathParams.length && `pathParams: ${JSON.stringify(pathParams)}`,
      ]

      const serverPathname =
        route.resolvedPathname[0] === '/'
          ? route.resolvedPathname
          : `/${route.resolvedPathname}`

      const serverProperties = sift([
        `path: "${serverPathname}"`,
        ...sharedProperties,
        `import: async () => (await import(${JSON.stringify(handlerPath)})).${route.exportedName} as any`,
        `format: "${route.resolvedFormat}"`,
        pathSchemaDecl && `pathSchema: ${pathSchemaDecl}`,
        requestSchemaDecl && `requestSchema: ${requestSchemaDecl}`,
        `responseSchema: ${responseSchemaDecl}`,
      ])

      serverDefinitions.push(`{${serverProperties.join(', ')}}`)

      const resolvedPathParams = route.resolvedPathParams
        ? stripTypeConstraints(route.resolvedPathParams)
        : 'Record<string, never>'

      const resolvedRequestData =
        dataArgument && dataArgument !== 'any'
          ? stripTypeConstraints(dataArgument)
          : 'Record<string, never>'

      const clientParamsExist =
        resolvedPathParams !== 'Record<string, never>' ||
        resolvedRequestData !== 'Record<string, never>'

      const clientParamsAreOptional =
        !clientParamsExist ||
        (ts.arePropertiesOptional(resolvedPathParams) &&
          ts.arePropertiesOptional(resolvedRequestData))

      const clientArgs: string[] = ['requestOptions?: RequestOptions']
      if (clientParamsExist) {
        clientTypeImports.add('RequestParams')
        clientArgs.unshift(
          `params${clientParamsAreOptional ? '?' : ''}: RequestParams<${resolvedPathParams}, ${resolvedRequestData}>${clientParamsAreOptional ? ' | null' : ''}`
        )
      }

      let clientReturn: string
      if (route.resolvedFormat === 'json-seq') {
        clientTypeImports.add('ResponseStream')
        clientReturn = route.resolvedResult.replace(/^\w+/, 'ResponseStream')
      } else if (route.resolvedFormat === 'json') {
        clientReturn = `Promise<${route.resolvedResult}>`
      } else if (route.resolvedFormat === 'response') {
        clientTypeImports.add('ResponsePromise')
        clientReturn = 'ResponsePromise'
      } else {
        throw new Error(`Unsupported response format: ${route.resolvedFormat}`)
      }

      const description =
        route.description &&
        `/**\n${route.description.replace(/^/gm, ' * ')}\n */\n`

      // Ky doesn't support leading slashes in pathnames.
      const clientPathname =
        route.resolvedPathname[0] === '/'
          ? route.resolvedPathname.slice(1)
          : route.resolvedPathname

      const clientProperties = sift([
        `path: "${clientPathname}"`,
        ...sharedProperties,
        `arity: ${clientParamsExist ? 2 : 1}`,
        `format: ${
          /^json-seq$/.test(route.resolvedFormat)
            ? camel(route.resolvedFormat)
            : `"${route.resolvedFormat}"`
        }`,
      ])

      clientFormats.add(route.resolvedFormat)
      clientDefinitions.push(
        (description || '') +
          `export const ${route.exportedName}: Route<"${clientPathname}", (${clientArgs.join(', ')}) => ${clientReturn}> = {${clientProperties.join(', ')}} as any`
      )
    }

    const clientTypeAliases = Array.from(referencedTypes.entries())
      .map(([symbol, type]) => `type ${symbol.getName()} = ${type}`)
      .join('\n')

    const serverTypeAliases =
      clientTypeAliases &&
      (await ts.generateServerTypeAliases(clientTypeAliases, typeConstraints))

    const writeServerDefinitions = (outFile: string) => {
      let imports = ''
      let sideEffects = ''

      if (serverImports.size > 0) {
        imports += `\nimport { ${[...serverImports].sort().join(', ')} } from "${store.serviceModuleId}/typebox"`
      }
      if (serverCheckedStringFormats.size > 0) {
        const sortedStringFormats = [...serverCheckedStringFormats].sort()
        const importedStringFormats = sortedStringFormats.map(
          name => pascal(name) + 'Format'
        )

        imports += `\nimport { addStringFormat, ${importedStringFormats.join(', ')} } from "${store.serviceModuleId}/format"`

        sortedStringFormats.forEach((format, index) => {
          sideEffects += `\naddStringFormat(${JSON.stringify(format)}, ${importedStringFormats[index]})`
        })
      }

      const content = sift([
        `import * as Type from "@sinclair/typebox/type"${imports}`,
        sideEffects.trimStart(),
        serverTypeAliases,
        `export default [${serverDefinitions.join(', ')}] as const`,
      ]).join('\n\n')

      fs.write(outFile, content)
    }

    const writeClientDefinitions = (outFile: string) => {
      let imports = ''

      // Delete the two formats that are always available.
      clientFormats.delete('json')
      clientFormats.delete('response')

      if (clientFormats.size > 0) {
        imports += Array.from(
          clientFormats,
          format =>
            `\nimport ${camel(format)} from "${store.clientModuleId}/formats/${format}"`
        ).join('')
      }

      const content = sift([
        `import type { ${[...clientTypeImports].sort().join(', ')} } from "${store.clientModuleId}"` +
          imports,
        clientTypeAliases.replace(/^(type|interface)/gm, 'export $1'),
        ...clientDefinitions,
      ]).join('\n\n')

      fs.write(outFile, content)
    }

    writeServerDefinitions(options.serverOutFile)
    writeClientDefinitions(options.clientOutFile)
  })

function isProjectInvalidated(store: Store, changes: FileChange[]) {
  return (
    !store.tsConfigFilePath ||
    changes.some(change => change.file === store.tsConfigFilePath)
  )
}

function resolveImportPath(
  fromPath: string,
  toPath: string,
  allowImportingTsExtensions?: boolean
) {
  let result = path.relative(path.dirname(fromPath), toPath)

  if (!allowImportingTsExtensions) {
    result = result.replace(/\.ts$/, '.js')
  }

  if (!result.startsWith('..')) {
    result = './' + result
  }
  return result
}

function stripTypeConstraints(type: string) {
  return type.replace(
    new RegExp(` & (${typeConstraints.join('|')})(?:\<.+?\>)?`, 'g'),
    ''
  )
}

function resolveModule(
  returnKind: 'path' | 'id',
  importer: string,
  candidateIds: string[]
) {
  const resolve = createResolver(importer, { resolveToAbsolute: true })
  for (const id of candidateIds) {
    const resolvedId = guard(() => resolve(id))
    if (resolvedId) {
      return returnKind === 'path' ? resolvedId : id
    }
  }
  throw new Error(
    'Could not find any of the following modules: ' +
      candidateIds.join(', ') +
      '\n' +
      'from this module: ' +
      importer
  )
}
