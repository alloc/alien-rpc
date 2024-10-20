import create, { Options } from '@alien-rpc/generator'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import prettier from 'prettier'
import { sort } from 'radashi'
import { globSync } from 'tinyglobby'

describe.concurrent('generator', () => {
  const fixturesDir = join(__dirname, '__fixtures__')
  const fixtures = globSync(['**/routes.ts', '!**/tmp-*'], {
    cwd: fixturesDir,
    absolute: true,
  })

  type RpcGenerator = {
    root: string
    options: Options
    start: ReturnType<typeof create>
    instance: ReturnType<ReturnType<typeof create>> | null
    tests: {
      name: string
      run: () => Promise<void>
    }[]
  }

  const generators: Record<string, RpcGenerator> = {}

  const getOptionsHash = (options: Options) => {
    const json = JSON.stringify(options)
    return createHash('md5').update(json).digest('hex').slice(0, 16)
  }

  for (const routeFile of fixtures) {
    const testDir = dirname(routeFile)
    const testName = relative(fixturesDir, testDir)

    const options: Options = {
      include: ['routes.ts'],
      outDir: '.',
    }

    const optionsFile = join(testDir, 'options.json')
    if (existsSync(optionsFile)) {
      Object.assign(options, JSON.parse(readFileSync(optionsFile, 'utf-8')))
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
          extends: relative(root, resolve(__dirname, '../tsconfig.json')),
          include: ['./'],
          exclude: [],
        })
      )

      generator = generators[optionsHash] = {
        root,
        options,
        start: create(options),
        instance: null,
        tests: [],
      }
    }

    generator.tests.push({
      name: testName,
      run: async () => {
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

        generator.instance ??= (() => {
          const instance = generator.start({ root, watch: true })
          instance.events
            .on('start', () => {
              console.log('start')
            })
            .on('write', file => {
              console.log('write:', file)
            })

          return instance
        })()

        await generator.instance.waitForStart(5000)
        await generator.instance

        const outputFiles = globSync('**/*.ts', { cwd: root })
        const output = await Promise.all(
          sort(outputFiles, name => name.split('/').length).map(async name => {
            const file = join(root, name)
            const fileInfo = await prettier.getFileInfo(file)

            let content = readFileSync(file, 'utf-8')
            if (fileInfo.inferredParser) {
              content = await prettier.format(content, {
                parser: fileInfo.inferredParser,
                filepath: file,
              })
            }

            return `/**\n * ${name}\n */\n${content}`
          })
        ).then(files => {
          return '// @ts-nocheck\n\n' + files.join('\n')
        })

        // Copy the generated files back to the test directory, where they
        // will be used by the client test.
        for (const file of outputFiles) {
          if (file.endsWith('/api.ts')) {
            const outFile = join(testDir, file)
            mkdirSync(dirname(outFile), { recursive: true })
            copyFileSync(join(root, file), outFile)
          }
        }

        const snapshotFile =
          testDir.replace('__fixtures__', '__snapshots__') + '.snap.ts'

        await expect(output).toMatchFileSnapshot(snapshotFile)
      },
    })
  }

  for (const generator of Object.values(generators)) {
    describe.sequential(JSON.stringify(generator.options), () => {
      for (const { name, run } of generator.tests) {
        test(name, run)
      }
    })
  }

  afterAll(async () => {
    await Promise.all(
      Object.values(generators).map(generator => generator.instance?.destroy())
    )
    for (const generator of Object.values(generators)) {
      rmSync(generator.root, { recursive: true, force: true })
    }
  })
})
