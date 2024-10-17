import { createProject, Project, ts } from '@ts-morph/bootstrap'
import { File } from 'jumpgen'
import path from 'node:path'

export type ParseResult = Awaited<ReturnType<typeof parse>>

export async function parse(files: File[]) {
  const tsConfigFilePath = ts.findConfigFile(
    files[0].absolutePath,
    ts.sys.fileExists
  )
  const project = await createProject({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  })
  const types = createSupportingTypes(
    project,
    path.dirname(files[0].absolutePath)
  )
  const sourceFiles = files.map(file =>
    project.createSourceFile(file.absolutePath, file.read('utf8'))
  )

  // All source files should have been added to the project by now.
  project.resolveSourceFileDependencies()

  const program = project.createProgram()
  const typeChecker = program.getTypeChecker()

  return {
    types,
    sourceFiles,
    typeChecker,
    program,
  }
}

export type SupportingTypes = ReturnType<typeof createSupportingTypes>

/**
 * Supporting types are used when generating the route definitions for
 * client and server. They help us ensure that the routes don't use any
 * unsupported types.
 */
function createSupportingTypes(project: Project, rootDir: string) {
  const typeDeclarations = {
    AnyNonNull: '{}',
    Response: 'globalThis.Response',
    RouteIterator: 'import("@alien-rpc/service").RouteIterator',
    RouteMethod: 'import("@alien-rpc/service").RouteMethod',
    RouteResult: 'import("@alien-rpc/service").RouteResult',
    Void: 'void',
  } as const

  type TypeValidator = (typeChecker: ts.TypeChecker, type: ts.Type) => void

  const typeValidation: Record<string, TypeValidator> = {
    Response(typeChecker: ts.TypeChecker, type: ts.Type) {
      // If the type "{}" is assignable to our "Response" type, then
      // something is misconfigured on the user's end.
      if (typeChecker.isTypeAssignableTo(types.AnyNonNull(typeChecker), type)) {
        throw new Error(
          `Could not resolve Response type. Make sure @types/node is installed in your project. If already installed, it may need to be re-installed.`
        )
      }
    },
    RouteIterator(typeChecker: ts.TypeChecker, type: ts.Type) {
      // If the type "{}" is assignable to our "RouteIterator" type, then
      // something is misconfigured on the user's end.
      if (typeChecker.isTypeAssignableTo(types.AnyNonNull(typeChecker), type)) {
        throw new Error(
          `Could not resolve RouteIterator type. Make sure your tsconfig has "es2018" or higher in its \`lib\` array.`
        )
      }
    },
  }

  const sourceFile = project.createSourceFile(
    path.join(rootDir, '.alien-rpc/support.ts'),
    Object.entries(typeDeclarations)
      .map(([id, aliasedType]) => `export type ${id} = ${aliasedType}`)
      .join('\n')
  )

  type TypeGetter = (typeChecker: ts.TypeChecker) => ts.Type

  const typeCache: Record<string, ts.Type> = {}

  const syntaxList = sourceFile.getChildAt(0)
  const types = Object.fromEntries(
    Object.keys(typeDeclarations).map((typeName, i) => {
      const getType: TypeGetter = typeChecker => {
        let type = typeCache[typeName]
        if (type) {
          return type
        }

        const typeNode = syntaxList.getChildAt(i)
        if (!ts.isTypeAliasDeclaration(typeNode)) {
          throw new Error(
            `Expected "${typeName}" to be TypeAliasDeclaration, got ${ts.SyntaxKind[typeNode.kind]}`
          )
        }

        type = typeChecker.getTypeAtLocation(typeNode)
        if (typeName in typeValidation) {
          typeValidation[typeName](typeChecker, type)
        }

        typeCache[typeName] = type
        return type
      }

      return [typeName, getType] as const
    })
  ) as {
    [TypeName in keyof typeof typeDeclarations]: TypeGetter
  }

  return types
}
