import { defineClient } from '@alien-rpc/client'
import { compileRoutes } from '@alien-rpc/service'
import { createTestClient, CreateTestClientArgs } from '@hattip/adapter-test'
import { copyFileSync, globSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createTestContext, TestContext } from './helper.js'

describe.concurrent('client', async () => {
  let generators: TestContext

  beforeAll(async () => {
    const fixturesDir = join(__dirname, 'client/__fixtures__')
    const testDir = join(fixturesDir, 'kitchen-sink')

    generators = createTestContext()
    const generator = generators.get(fixturesDir)
    generator.resetFiles(testDir)
    await generator.start()

    // Copy the generated files back to the test directory
    const outputFiles = globSync(['tsconfig.json', '**/api.ts'], {
      cwd: generator.root,
    })
    for (const file of outputFiles) {
      const outFile = join(testDir, file)
      mkdirSync(dirname(outFile), { recursive: true })
      copyFileSync(join(generator.root, file), outFile)
    }
  })

  afterAll(async () => {
    // await generators.clear()
  })

  test('route with no parameters', async () => {
    const client = await getTestClient()
    const result = await client.getOne()
    expect(result).toBe(1)
  })

  test('route with a single parameter', async () => {
    const client = await getTestClient()

    let result = await client.getPostById('123')
    expect(result).toBe('123')

    result = await client.getPostById({ id: '123' })
    expect(result).toBe('123')
  })

  test('route with an optional parameter', async () => {
    const client = await getTestClient()

    let result = await client.getAllPosts({ limit: 3 })
    expect(result).toEqual([0, 1, 2])

    result = await client.getAllPosts()
    expect(result).toEqual([0, 1, 2, 3, 4])
  })
})

async function getTestClient() {
  const clientRoutes = await import(
    './client/__fixtures__/kitchen-sink/client/api.js'
  )
  const { default: serverRoutes } = await import(
    './client/__fixtures__/kitchen-sink/server/api.js'
  )

  const handler = compileRoutes(serverRoutes, {
    returnNotFound: true,
  })

  return defineClient(clientRoutes, {
    prefixUrl: 'http://example.com/',
    fetch: createTestClient({
      handler: handler as CreateTestClientArgs['handler'],
    }),
  })
}
