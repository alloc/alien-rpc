import create, { Options } from '@alien-rpc/generator'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { globSync } from 'tinyglobby'

function getOptionsHash(options: Options) {
  const json = JSON.stringify(options)
  return createHash('md5').update(json).digest('hex').slice(0, 16)
}

export type TestGenerator = {
  root: string
  options: Options
  start: ReturnType<typeof create>
  resetFiles: (testDir: string) => void
  instance: ReturnType<ReturnType<typeof create>> | null
  tests: {
    name: string
    run: () => Promise<void>
  }[]
}

export type TestContext = ReturnType<typeof createTestContext>

export function createTestContext() {
  const generators: Record<string, TestGenerator> = {}

  function get(fixturesDir: string, overrides?: Partial<Options>) {
    const options: Options = {
      include: ['routes.ts'],
      outDir: '.',
      ...overrides,
    }

    const optionsHash = getOptionsHash(options)
    const root = join(fixturesDir, 'tmp-' + optionsHash)

    let generator = generators[optionsHash]
    if (!generator) {
      rmSync(root, { recursive: true, force: true })
      mkdirSync(root)
      writeFileSync(
        join(root, 'tsconfig.json'),
        JSON.stringify({
          extends: relative(root, resolve(__dirname, 'tsconfig.json')),
          include: ['./'],
          exclude: [],
        })
      )

      const start = create(options)

      const resetFiles = (testDir: string) => {
        const inputFiles = globSync(['**/*.ts', '!api.ts'], { cwd: testDir })
        for (const file of inputFiles) {
          const outFile = join(root, file)
          mkdirSync(dirname(outFile), { recursive: true })
          copyFileSync(join(testDir, file), outFile)
        }

        const oldFiles = globSync(['**/*.ts', '!api.ts'], { cwd: root })
        for (const oldFile of oldFiles) {
          if (!inputFiles.includes(oldFile)) {
            rmSync(join(root, oldFile))
          }
        }
      }

      generator = generators[optionsHash] = {
        root,
        options,
        start: options => start({ root, ...options }),
        resetFiles,
        instance: null,
        tests: [],
      }
    }

    return generator
  }

  async function clear() {
    await Promise.all(
      Object.values(generators).map(generator => generator.instance?.destroy())
    )
    for (const generator of Object.values(generators)) {
      rmSync(generator.root, { recursive: true, force: true })
    }
  }

  return {
    get current() {
      return Object.values(generators)
    },
    get,
    clear,
  }
}
