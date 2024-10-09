import path from 'path'
import { test } from 'vitest'
import create from '../src/generator.js'

test('generator', async () => {
  const root = path.resolve('test/__fixtures__/basic')
  const generate = create({
    apiVersion: '1',
    routesFile: 'routes.ts',
    outDir: '.',
  })
  await generate({
    root,
  })
})
