import { bodylessMethods } from '@alien-rpc/route'
import { createProject, Project } from '@ts-morph/bootstrap'
import { ts } from '@ts-morph/common'
import createResolver from 'esm-resolve'
import { jumpgen, JumpgenFS } from 'jumpgen'
import path from 'path'
import { parsePathParams } from 'pathic'
import { camel, guard, pascal, sift } from 'radashi'
import { AnalyzedFile, analyzeFile } from './analyze-file.js'
import { AnalyzedRoute } from './analyze-route.js'
import { reportDiagnostics } from './diagnostics.js'
import { typeConstraints } from './type-constraints.js'
import { TypeScriptToTypeBox } from './typebox-codegen/typescript/generator.js'
import {
  createSupportingTypes,
  SupportingTypes,
} from './typescript/supporting-types.js'
import { findTsConfigFiles } from './typescript/tsconfig.js'

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

interface Store {
  project: Project
  types: SupportingTypes
  analyzedFiles: Map<ts.SourceFile, AnalyzedFile>
  serviceModuleId: string
  clientModuleId: string
}

type Event = { type: 'route'; route: AnalyzedRoute }

export default (options: Options) =>
  jumpgen<Store, Event, void>('alien-rpc', async context => {
    const { fs, root, store, emit, changes } = context

    const entryFilePaths = fs.scan(options.include, {
      cwd: root,
      absolute: true,
    })

    if (!entryFilePaths.length) {
      throw new Error(
        `No files matching ${JSON.stringify(options.include)} were found in ${JSON.stringify(root)}`
      )
    }

    options = { ...options }
    options.outDir = path.resolve(root, options.outDir)

    options.serverOutFile ??= 'server/generated/api.ts'
    options.serverOutFile = path.resolve(options.outDir, options.serverOutFile)

    options.clientOutFile ??= 'client/generated/api.ts'
    options.clientOutFile = path.resolve(options.outDir, options.clientOutFile)

    if (store.project == null) {
      const tsConfigFilePath = path.resolve(
        root,
        options.tsConfigFile ?? 'tsconfig.json'
      )
      store.project = await createProject({
        tsConfigFilePath,
        skipAddingFilesFromTsConfig: true,
      })
      store.serviceModuleId = resolveModule(options.serverOutFile, [
        'alien-rpc/service',
        '@alien-rpc/service',
      ])
      store.clientModuleId = resolveModule(options.clientOutFile, [
        'alien-rpc/client',
        '@alien-rpc/client',
      ])
      store.types = createSupportingTypes(
        store.project,
        path.dirname(tsConfigFilePath),
        store.serviceModuleId
      )
      for (const filePath of entryFilePaths) {
        store.project.createSourceFile(filePath, fs.read(filePath, 'utf8'))
      }
      store.analyzedFiles = new Map()
    } else {
      for (let { file, event } of changes) {
        file = path.join(root, file)

        if (event === 'add') {
          store.project.createSourceFile(file, fs.read(file, 'utf8'))
        } else {
          store.analyzedFiles.delete(store.project.getSourceFileOrThrow(file))
          if (event === 'unlink') {
            store.project.removeSourceFile(file)
          } else {
            store.project.updateSourceFile(file, fs.read(file, 'utf8'))
          }
        }
      }
      store.types.clear()
    }

    const { project, types, analyzedFiles } = store

    project.resolveSourceFileDependencies()

    const program = project.createProgram()
    const typeChecker = program.getTypeChecker()
    const compilerOptions = program.getCompilerOptions()
    const moduleResolutionHost = project.getModuleResolutionHost()

    reportDiagnostics(program, options.verbose, (specifier, importer) => {
      watchMissingImport(
        importer,
        specifier,
        compilerOptions,
        moduleResolutionHost,
        fs
      )
    })

    const referencedTypes = new Map<ts.Symbol, string>()
    const routes = project
      .getSourceFiles()
      .filter(sourceFile => entryFilePaths.includes(sourceFile.fileName))
      .flatMap(sourceFile => {
        let metadata = analyzedFiles.get(sourceFile)
        if (!metadata) {
          metadata = analyzeFile(sourceFile, typeChecker, types)
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

          if (context.isWatchMode)
            watchDependencies(
              sourceFile,
              compilerOptions,
              moduleResolutionHost,
              project,
              fs
            )
        }
        for (const [symbol, type] of metadata.referencedTypes) {
          referencedTypes.set(symbol, type)
        }
        return metadata.routes
      })

    if (!routes.length) {
      throw new Error('No routes were exported by the included files')
    }

    const clientDefinitions: string[] = []
    const clientTypeImports = new Set<string>(['RequestOptions', 'Route'])
    const clientFormats = new Set<string>()

    const serverDefinitions: string[] = []
    const serverImports = new Set<string>()
    const serverCheckedStringFormats = new Set<string>()

    const tsconfigs = findTsConfigFiles(fs, project)
    const serverTsConfig = tsconfigs.find(tsconfig =>
      tsconfig.paths.filePaths.includes(options.serverOutFile)
    )!

    for (const route of routes) {
      let pathSchemaDecl = ''
      let requestSchemaDecl = ''

      if (
        route.resolvedPathParams &&
        needsPathSchema(route.resolvedPathParams)
      ) {
        pathSchemaDecl = generateRuntimeValidator(
          `type Path = ${route.resolvedPathParams}`
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
        requestSchemaDecl = generateRuntimeValidator(
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
          : generateRuntimeValidator(`type Response = ${route.resolvedResult}`)

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
        (arePropertiesOptional(resolvedPathParams) &&
          arePropertiesOptional(resolvedRequestData))

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
      TypeScriptToTypeBox.Generate(clientTypeAliases, {
        useTypeBoxImport: false,
        useEmitConstOnly: true,
        typeTags: typeConstraints,
      })

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

function generateRuntimeValidator(code: string) {
  const generatedCode = TypeScriptToTypeBox.Generate(code, {
    useTypeBoxImport: false,
    useEmitConstOnly: true,
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

function parseTypeLiteral(type: string) {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    `type Temp = ${type}`,
    ts.ScriptTarget.Latest
  )
  return (sourceFile.statements[0] as ts.TypeAliasDeclaration).type
}

function watchMissingImport(
  sourceFile: ts.SourceFile,
  specifier: string,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost,
  fs: JumpgenFS
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

function watchDependencies(
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost,
  project: Project,
  fs: JumpgenFS,
  seen = new Set<ts.SourceFile>()
): Set<ts.SourceFile> {
  if (seen.has(sourceFile)) return seen
  seen.add(sourceFile)

  // Use a private API to get the referenced modules.
  const imports = ((sourceFile as any).imports ?? []) as ts.StringLiteral[]

  for (const specifier of imports) {
    // Note: We *could* watch failedLookupLocations, but the memory
    // cost may not be worth it and I'm too lazy to check, so let's
    // just do less to be safe.
    const { resolvedModule, affectingLocations } = ts.resolveModuleName(
      specifier.text,
      sourceFile.fileName,
      compilerOptions,
      moduleResolutionHost
    ) as {
      resolvedModule?: ts.ResolvedModuleFull
      failedLookupLocations: string[]
      affectingLocations?: string[]
    }

    if (resolvedModule) {
      const resolvedPath = resolvedModule.resolvedFileName

      // There's no need to watch certain dependencies that won't influence
      // the inferred type of a route.
      if (/\/node_modules\/(@sinclair\/typebox)\//.test(resolvedPath)) {
        return seen
      }

      fs.watch(resolvedPath, {
        cause: sourceFile.fileName,
      })

      // An original path will exist if the import resolved to a symlink.
      // In that case, originalPath is the symlink location.
      const originalPath = (resolvedModule as any).originalPath
      if (originalPath) {
        fs.watch(originalPath, {
          cause: sourceFile.fileName,
        })
      }

      watchDependencies(
        project.getSourceFileOrThrow(resolvedPath),
        compilerOptions,
        moduleResolutionHost,
        project,
        fs,
        seen
      )
    }

    if (affectingLocations)
      fs.watch(affectingLocations, {
        cause: sourceFile.fileName,
      })
  }

  return seen
}

function stripTypeConstraints(type: string) {
  return type.replace(
    new RegExp(` & (${typeConstraints.join('|')})(?:\<.+?\>)?`, 'g'),
    ''
  )
}

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

function resolveModule(importer: string, candidateIds: string[]) {
  const resolve = createResolver(importer)
  for (const id of candidateIds) {
    if (guard(() => resolve(id))) {
      return id
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
