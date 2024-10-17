import create, { Options } from '@alien-rpc/generator'
import { FileSystemHost, RuntimeDirEntry } from '@ts-morph/common'
import { vol } from 'memfs'
import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { sort, uid } from 'radashi'
import { globSync } from 'tinyglobby'
import { ExpectStatic } from 'vitest'

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
    'tsconfig.json': JSON.stringify({
      extends: '../../tsconfig.json',
      include: ['**/*.ts'],
    }),
  }

  vol.fromJSON(sourceFiles, root)

  const generator = create({
    projectPath: '.',
    outDir: '.',
    fileSystem: new MemfsFileSystemHost(root),
    ...options,
  })

  try {
    await generator({ root })
  } catch (error) {
    console.log(recursiveRead(root))
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

function recursiveRead(
  dir: string,
  files: Record<string, string> = {},
  root = dir
): Record<string, string> {
  fs.readdirSync(dir).forEach(name => {
    if (name === '.') return

    const file = path.join(dir, name)
    const stat = fs.statSync(file)

    if (stat.isDirectory()) {
      recursiveRead(file, files, root)
    } else {
      const key = path.relative(root, file)
      files[key] = fs.readFileSync(file, 'utf8')
    }
  })
  return files
}

class MemfsFileSystemHost implements FileSystemHost {
  constructor(private readonly root: string) {}

  isCaseSensitive(): boolean {
    return true
  }

  readDirSync(dirPath: string): RuntimeDirEntry[] {
    return fs
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
    return fs.readFileSync(
      path.resolve(this.root, filePath),
      encoding as BufferEncoding
    )
  }

  async fileExists(filePath: string) {
    return this.fileExistsSync(path.resolve(this.root, filePath))
  }

  fileExistsSync(filePath: string) {
    const stat = fs.statSync(path.resolve(this.root, filePath), {
      throwIfNoEntry: false,
    })
    return stat !== undefined && stat.isFile()
  }

  async directoryExists(dirPath: string) {
    return this.directoryExistsSync(path.resolve(this.root, dirPath))
  }

  directoryExistsSync(dirPath: string): boolean {
    const stat = fs.statSync(path.resolve(this.root, dirPath), {
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
