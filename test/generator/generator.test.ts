import create, { Options } from '@alien-rpc/generator'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, join, relative, resolve } from 'path'
import prettier from 'prettier'
import { sort } from 'radashi'
import { globSync } from 'tinyglobby'

const cwd = new URL('.', import.meta.url).pathname
console.log({ cwd })

const fixtures = globSync('**/__fixtures__/*', {
  cwd,
  absolute: true,
  onlyDirectories: true,
})

for (const root of fixtures) {
  test(basename(root), async () => {
    const options: Options = {
      include: ['routes.ts'],
      outDir: '.',
    }
    const optionsFile = join(root, 'options.json')
    if (existsSync(optionsFile)) {
      Object.assign(options, JSON.parse(readFileSync(optionsFile, 'utf-8')))
    }

    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        extends: relative(root, resolve(cwd, '../tsconfig.json')),
        include: ['./'],
        exclude: [],
      })
    )

    const generator = create(options)
    await generator({ root })

    const files = globSync('**/*.ts', { cwd: root })
    const output = await Promise.all(
      sort(files, name => name.split('/').length).map(async name => {
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

    const snapshotFile = root
      .replace('__fixtures__', '__snapshots__')
      .replace(/\/$/, '.snap.ts')

    expect(output).toMatchFileSnapshot(snapshotFile)
  })
}
