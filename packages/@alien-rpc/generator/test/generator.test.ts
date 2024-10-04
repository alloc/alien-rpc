import fs from 'fs'
import path from 'path'
import { test } from 'vitest'
import { extractRouteTypes } from '../src/typescript'

test('extractRouteTypes', async () => {
  const fileName = path.resolve('test/__fixtures__/basic/routes.ts')
  const sourceCode = fs.readFileSync(fileName, 'utf-8')

  await extractRouteTypes(sourceCode, fileName)
})
