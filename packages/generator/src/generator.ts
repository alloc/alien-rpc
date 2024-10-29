import { bodylessMethods } from '@alien-rpc/route'
import { createProject, Project } from '@ts-morph/bootstrap'
import { ts } from '@ts-morph/common'
import { jumpgen, JumpgenFS } from 'jumpgen'
import path from 'path'
import { parsePathParams } from 'pathic'
import { camel, pascal, sift } from 'radashi'
import { AnalyzedRoute, analyzeRoutes } from './analyze-routes.js'
import { reportDiagnostics } from './diagnostics.js'
import { typeConstraints } from './type-constraints.js'
import { TypeScriptToTypeBox } from './typebox-codegen/typescript/generator.js'
import {
  createSupportingTypes,
  SupportingTypes,
} from './typescript/supporting-types.js'

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
   * @default 'server/api.ts'
   */
  serverOutFile?: string
  /**
   * @default 'client/api.ts'
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
  routesByFile: Map<ts.SourceFile, AnalyzedRoute[]>
}

type Event = { type: 'route'; route: AnalyzedRoute }

export default (options: Options) =>
  jumpgen<Store, Event, void>('alien-rpc', async context => {
    const { fs, dedent, root, store, emit, changes } = context

    const sourceFilePaths = fs.scan(options.include, {
      cwd: root,
      absolute: true,
    })

    if (store.project == null) {
      const tsConfigFilePath = path.resolve(
        root,
        options.tsConfigFile ?? 'tsconfig.json'
      )
      store.project = await createProject({
        tsConfigFilePath,
        skipAddingFilesFromTsConfig: true,
      })
      store.types = createSupportingTypes(
        store.project,
        path.dirname(tsConfigFilePath)
      )
      for (const filePath of sourceFilePaths) {
        store.project.createSourceFile(filePath, fs.read(filePath, 'utf8'))
      }
      store.routesByFile = new Map()
    } else {
      for (let { file, event } of changes) {
        file = path.join(root, file)

        if (event === 'add') {
          store.project.createSourceFile(file, fs.read(file, 'utf8'))
        } else {
          store.routesByFile.delete(store.project.getSourceFileOrThrow(file))
          if (event === 'unlink') {
            store.project.removeSourceFile(file)
          } else {
            store.project.updateSourceFile(file, fs.read(file, 'utf8'))
          }
        }
      }
      store.types.clear()
    }

    const { project, types, routesByFile } = store

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

    const routes = project
      .getSourceFiles()
      .filter(file => sourceFilePaths.includes(file.fileName))
      .flatMap(sourceFile => {
        let routes = routesByFile.get(sourceFile)
        if (!routes) {
          routes = analyzeRoutes(sourceFile, typeChecker, types)
          routesByFile.set(sourceFile, routes)

          // Prepend the API version to all route pathnames.
          if (options.versionPrefix) {
            for (const route of routes) {
              route.resolvedPathname = `/${options.versionPrefix}${route.resolvedPathname}`
            }
          }

          routes.forEach(route => {
            emit({ type: 'route', route })
          })

          if (context.isWatchMode)
            watchDependencies(
              sourceFile,
              compilerOptions,
              moduleResolutionHost,
              project,
              fs
            )
        }
        return routes
      })

    options = { ...options }

    options.serverOutFile ??= 'server/api.ts'
    options.serverOutFile = path.join(options.outDir, options.serverOutFile)

    options.clientOutFile ??= 'client/api.ts'
    options.clientOutFile = path.join(options.outDir, options.clientOutFile)

    const serverDefinitions: string[] = []
    const clientDefinitions: string[] = []
    const serverImports = new Set<string>()
    const stringFormats = new Set<string>()
    const clientImports = new Set<string>(['RequestOptions', 'RpcRoute'])
    const clientFormats = new Set<string>()

    for (const route of routes) {
      const pathSchemaDecl =
        needsPathSchema(route.resolvedArguments[0]) &&
        generateRuntimeValidator(
          `type Path = ${route.resolvedArguments[0]}`
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

      let requestSchemaDecl = generateRuntimeValidator(
        `type Request = ${route.resolvedArguments[1]}`
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

      const responseSchemaDecl =
        route.resolvedFormat === 'response'
          ? `Type.Any()`
          : generateRuntimeValidator(`type Response = ${route.resolvedResult}`)

      for (const match of (
        pathSchemaDecl +
        requestSchemaDecl +
        responseSchemaDecl
      ).matchAll(/Type\.String\(.*?format:\s*['"](\w+)['"].*?\)/g)) {
        stringFormats.add(match[1])
      }

      const handlerPath = resolveImportPath(
        path.join(root, options.serverOutFile),
        route.fileName.replace(/\.ts$/, '.js')
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
        `requestSchema: ${requestSchemaDecl}`,
        `responseSchema: ${responseSchemaDecl}`,
      ])

      serverDefinitions.push(`{${serverProperties.join(', ')}}`)

      const resolvedPathParams = stripTypeConstraints(
        route.resolvedArguments[0]
      )
      const resolvedExtraParams = stripTypeConstraints(
        route.resolvedArguments[1]
      )

      const expectsParams =
        resolvedPathParams !== 'Record<string, never>' ||
        resolvedExtraParams !== 'Record<string, never>'

      const optionalParams =
        !expectsParams ||
        (arePropertiesOptional(resolvedPathParams) &&
          arePropertiesOptional(resolvedExtraParams))

      const clientArgs: string[] = ['requestOptions?: RequestOptions']
      if (expectsParams) {
        clientImports.add('RequestParams')
        clientArgs.unshift(
          `params${optionalParams ? '?' : ''}: RequestParams<${resolvedPathParams}, ${resolvedExtraParams}>${optionalParams ? ' | null' : ''}`
        )
      }

      let clientReturn: string
      if (route.resolvedFormat === 'json-seq') {
        clientImports.add('ResponseStream')
        clientReturn = route.resolvedResult.replace(/^\w+/, 'ResponseStream')
      } else if (route.resolvedFormat === 'json') {
        clientReturn = `Promise<${route.resolvedResult}>`
      } else if (route.resolvedFormat === 'response') {
        clientImports.add('ResponsePromise')
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
        `arity: ${expectsParams ? 2 : 1}`,
        `format: ${
          /^json-seq$/.test(route.resolvedFormat)
            ? camel(route.resolvedFormat)
            : `"${route.resolvedFormat}"`
        }`,
      ])

      clientFormats.add(route.resolvedFormat)
      clientDefinitions.push(
        (description || '') +
          `export const ${route.exportedName}: RpcRoute<"${clientPathname}", (${clientArgs.join(', ')}) => ${clientReturn}> = {${clientProperties.join(', ')}} as any`
      )
    }

    const writeServerDefinitions = (outFile: string) => {
      let imports = ''
      let sideEffects = ''

      if (serverImports.size > 0) {
        imports += `\nimport { ${[...serverImports].sort().join(', ')} } from "@alien-rpc/service/typebox"`
      }
      if (stringFormats.size > 0) {
        const sortedFormats = [...stringFormats].sort()
        const exportedFormats = sortedFormats.map(
          name => pascal(name) + 'Format'
        )

        imports += `\nimport { addStringFormat, ${exportedFormats.join(', ')} } from "@alien-rpc/service/format"`

        sortedFormats.forEach((format, index) => {
          sideEffects += `\naddStringFormat(${JSON.stringify(format)}, ${exportedFormats[index]})`
        })
      }

      const content = sift([
        `import { Type } from "@sinclair/typebox"${imports}`,
        sideEffects.trimStart(),
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
            `\nimport ${camel(format)} from '@alien-rpc/client/formats/${format}'`
        ).join('')
      }

      const content = dedent/* ts */ `
        import { ${[...clientImports].sort().join(', ')} } from '@alien-rpc/client'${imports}

        ${clientDefinitions.join('\n\n')}
      `

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

function resolveImportPath(fromPath: string, toPath: string) {
  let result = path
    .relative(path.dirname(fromPath), toPath)
    .replace(/\.ts$/, '.js')

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
  const imports = (sourceFile as any).imports as ts.StringLiteral[]

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
  if (type === 'Record<string, never>') {
    return false
  }
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
