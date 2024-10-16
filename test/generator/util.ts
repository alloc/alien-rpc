import create, { Options } from '@alien-rpc/generator'
import { vol } from 'memfs'
import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { isFunction, uid } from 'radashi'
import { ExpectStatic } from 'vitest'

export async function testGenerate(
  expect: ExpectStatic,
  sourceCode: string,
  options?: Partial<Options>
) {
  const root = new URL('./__fixtures__/' + uid(12), import.meta.url).pathname

  vol.fromJSON({ 'routes.ts': sourceCode }, root)

  const generator = create({
    ...options,
    include: 'routes.ts',
    outDir: '.',
  })

  await generator({ root })

  const files = recursiveRead(root)

  const output = await Promise.all(
    Object.entries(files)
      .sort(prefer(([file]) => file === 'routes.ts'))
      .map(async ([file, content]) => {
        const fileInfo = await prettier.getFileInfo(file)

        if (fileInfo.inferredParser) {
          content = await prettier.format(content, {
            parser: fileInfo.inferredParser,
            filepath: file,
          })
        }

        return `/**\n * ${file}\n */\n${content}`
      })
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

type Fn = (...args: any[]) => any

function prefer<T>(...prefs: (Exclude<T, Fn> | ((value: T) => boolean))[]) {
  return (a: T, b: T): number => {
    for (const pref of prefs) {
      if (isFunction(pref)) {
        if (pref(a)) return -1
        if (pref(b)) return 1
      } else {
        if (Object.is(a, pref)) return -1
        if (Object.is(b, pref)) return 1
      }
    }
    return 0
  }
}
