import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import prettier from 'prettier'
import { sort } from 'radashi'
import { globSync } from 'tinyglobby'
import { createTestContext } from './helper.js'

describe.concurrent('generator', () => {
  const fixturesDir = join(__dirname, 'generator/__fixtures__')
  const fixtures = globSync(['**/routes.ts', '!**/tmp-*'], {
    cwd: fixturesDir,
    absolute: true,
  })

  const generators = createTestContext()

  for (const routeFile of fixtures) {
    const testDir = dirname(routeFile)
    const testName = relative(fixturesDir, testDir)

    const optionsFile = join(testDir, 'options.json')
    const overrides = existsSync(optionsFile)
      ? JSON.parse(readFileSync(optionsFile, 'utf-8'))
      : {}

    const generator = generators.get(fixturesDir, overrides)

    generator.tests.push({
      name: testName,
      run: async () => {
        generator.resetFiles(testDir)
        generator.instance ??= (() => {
          const instance = generator.start({
            watch: true,
          })

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

        const outputFiles = globSync('**/*.ts', {
          cwd: generator.root,
        })

        const output = await Promise.all(
          sort(outputFiles, name => name.split('/').length).map(async name => {
            const file = join(generator.root, name)
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
            copyFileSync(join(generator.root, file), outFile)
          }
        }

        const snapshotFile =
          testDir.replace('__fixtures__', '__snapshots__') + '.snap.ts'

        await expect(output).toMatchFileSnapshot(snapshotFile)
      },
    })
  }

  for (const generator of generators.current) {
    describe.sequential(JSON.stringify(generator.options), () => {
      for (const { name, run } of generator.tests) {
        test(name, run)
      }
    })
  }

  afterAll(generators.clear)
})
