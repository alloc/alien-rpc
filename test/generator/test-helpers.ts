import create, { Options } from '@alien-rpc/generator'
import { FileSystemHost, RuntimeDirEntry } from '@ts-morph/common'
import { vol } from 'memfs'
import vfs from 'node:fs'
import path from 'node:path'
import { isMatch } from 'picomatch'
import prettier from 'prettier'
import { sort, uid } from 'radashi'
import { globSync } from 'tinyglobby'
import { ExpectStatic } from 'vitest'

const fixturesDir = new URL('__fixtures__', import.meta.url).pathname
const nodeModulesDir = path.join(fixturesDir, 'node_modules')
const fromNodeModulesDir = new URL('../../node_modules', import.meta.url)
  .pathname

const fs = await vi.importActual<typeof vfs>('node:fs')
const nodeModulesFilter = (file: string) =>
  /\/(@alien-rpc|@types\/node|undici-types)\//.test(file)

vol.fromJSON(
  recursiveRead(path.join(fromNodeModulesDir, '.pnpm'), {
    filter: nodeModulesFilter,
    fs,
  }),
  path.join(nodeModulesDir, '.pnpm')
)

const packageLinks = findPackageLinks(fromNodeModulesDir, {
  filter: nodeModulesFilter,
  fs,
})

for (const file of packageLinks) {
  const target = fs.readlinkSync(path.join(fromNodeModulesDir, file))
  console.log(file, '→', target)
  const newFile = path.join(nodeModulesDir, file)
  vfs.mkdirSync(path.dirname(newFile), {
    recursive: true,
  })
  vfs.symlinkSync(target, newFile)
}

console.log(Object.keys(vol.toJSON()).join('\n'))

export async function testGenerate(
  expect: ExpectStatic,
  sourceCode: string,
  options?: Partial<Options> & {
    files?: Record<string, string>
  }
) {
  const root = new URL('./__fixtures__/' + uid(12), import.meta.url).pathname
  const sourceFiles = {
    ...options?.files,
    'routes.ts': sourceCode,
  }

  vol.fromJSON(
    {
      ...sourceFiles,
      'tsconfig.json': JSON.stringify({
        include: ['./'],
        compilerOptions: {
          strict: true,
          lib: ['esnext'],
          module: 'esnext',
          moduleResolution: 'bundler',
          typeRoots: ['../node_modules/@types'],
          types: ['node'],
        },
      }),
      'package.json': JSON.stringify({
        name: 'test',
        type: 'module',
      }),
    },
    root
  )

  const generator = create({
    include: Object.keys(sourceFiles),
    outDir: '.',
    fileSystem: new MemfsFileSystemHost(root),
    ...options,
  })

  try {
    await generator({ root })
  } catch (error) {
    // console.log(recursiveRead(root))
    throw error
  }

  const files = recursiveRead(root)

  const output = await Promise.all(
    sort(Object.entries(files), ([file]) => file.split('/').length).map(
      async ([file, content]) => {
        const fileInfo = await prettier.getFileInfo(file)

        if (fileInfo.inferredParser) {
          content = await prettier.format(content, {
            parser: fileInfo.inferredParser,
            filepath: file,
          })
        }

        return `/**\n * ${file}\n */\n${content}`
      }
    )
  ).then(files => {
    return '// @ts-nocheck\n\n' + files.join('\n')
  })

  const state = expect.getState()
  const testPath = path.basename(state.testPath!).replace('.test.', '.snap.')

  await expect(output).toMatchFileSnapshot(path.join('__snapshots__', testPath))
}

class MemfsFileSystemHost implements FileSystemHost {
  constructor(private readonly root: string) {}

  isCaseSensitive(): boolean {
    return true
  }

  readDirSync(dirPath: string): RuntimeDirEntry[] {
    console.log('readDirSync:', dirPath)
    return vfs
      .readdirSync(path.resolve(this.root, dirPath), {
        withFileTypes: true,
      })
      .map(file => ({
        name: file.name,
        get isFile() {
          return file.isFile()
        },
        get isDirectory() {
          return file.isDirectory()
        },
        get isSymlink() {
          return file.isSymbolicLink()
        },
      }))
  }

  async readFile(filePath: string, encoding = 'utf-8') {
    return this.readFileSync(filePath, encoding)
  }

  readFileSync(filePath: string, encoding = 'utf-8') {
    console.log('readFileSync:', filePath)
    return vfs.readFileSync(
      path.resolve(this.root, filePath),
      encoding as BufferEncoding
    )
  }

  async fileExists(filePath: string) {
    return this.fileExistsSync(path.resolve(this.root, filePath))
  }

  fileExistsSync(filePath: string) {
    console.log('fileExistsSync:', filePath)
    const stat = vfs.statSync(path.resolve(this.root, filePath), {
      throwIfNoEntry: false,
    })
    return stat !== undefined && stat.isFile()
  }

  async directoryExists(dirPath: string) {
    return this.directoryExistsSync(path.resolve(this.root, dirPath))
  }

  directoryExistsSync(dirPath: string): boolean {
    // console.log('directoryExistsSync:', dirPath)
    const stat = vfs.statSync(path.resolve(this.root, dirPath), {
      throwIfNoEntry: false,
    })
    return stat !== undefined && stat.isDirectory()
  }

  realpathSync(path: string) {
    return path
  }

  getCurrentDirectory() {
    return this.root
  }

  async glob(patterns: ReadonlyArray<string>) {
    return this.globSync(patterns)
  }

  globSync(patterns: ReadonlyArray<string>): string[] {
    console.log('globSync:', patterns)
    return globSync(patterns as string[], { cwd: this.root })
  }

  async delete(path: string) {
    notImplemented('delete')
  }

  deleteSync(path: string): void {
    notImplemented('deleteSync')
  }

  async writeFile(filePath: string, fileText: string) {
    notImplemented('writeFile')
  }

  writeFileSync(filePath: string, fileText: string) {
    notImplemented('writeFileSync')
  }

  async mkdir(dirPath: string) {
    notImplemented('mkdir')
  }

  mkdirSync(dirPath: string) {
    notImplemented('mkdirSync')
  }

  async move(srcPath: string, destPath: string) {
    notImplemented('move')
  }

  moveSync(srcPath: string, destPath: string) {
    notImplemented('moveSync')
  }

  async copy(srcPath: string, destPath: string) {
    notImplemented('copy')
  }

  copySync(srcPath: string, destPath: string) {
    notImplemented('copySync')
  }
}

function notImplemented(methodName: string): never {
  throw new Error(`Method '${methodName}' is not implemented.`)
}

function findPackageLinks(
  dir: string,
  opts: {
    links?: string[]
    root?: string
    fs?: typeof fs
    recursive?: boolean
    filter?: (file: string) => boolean
  } = {}
) {
  const {
    links = [],
    root = dir,
    fs = vfs,
    recursive = true,
    filter = () => true,
  } = opts

  const recursiveOptions = {
    links,
    root,
    fs,
    recursive: false,
    filter,
  }

  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name)
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) {
      if (filter(file)) {
        links.push(path.relative(root, file))
      }
    }
    // Recurse into “package scope” directories.
    else if (recursive && name[0] === '@' && stat.isDirectory()) {
      findPackageLinks(file, recursiveOptions)
    }
  }

  return links
}

function recursiveRead(
  dir: string,
  opts: {
    files?: Record<string, string>
    root?: string
    fs?: typeof fs
    filter?: (file: string) => boolean
    dot?: boolean
    ignored?: string[]
    ignoreSymlinks?: boolean
  } = {}
): Record<string, string> {
  const {
    files = {},
    root = dir,
    fs = vfs,
    filter = () => true,
    dot = false,
    ignored = [],
    ignoreSymlinks = false,
  } = opts

  const recursiveOptions = {
    files,
    root,
    fs,
    filter,
    dot,
    ignored,
    ignoreSymlinks,
  }

  for (const name of fs.readdirSync(dir)) {
    if (!dot && name === '.') {
      continue
    }
    const file = path.join(dir, name)
    if (isMatch(file, ignored)) {
      continue
    }
    if (ignoreSymlinks && fs.lstatSync(file).isSymbolicLink()) {
      continue
    }
    const stat = fs.statSync(file)
    if (stat.isDirectory()) {
      recursiveRead(file, recursiveOptions)
    } else if (filter(file)) {
      const key = path.relative(root, file)
      files[key] = fs.readFileSync(file, 'utf8')
    }
  }

  return files
}
