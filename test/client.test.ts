import { defineClient } from '@alien-rpc/client'
import { compileRoutes } from '@alien-rpc/service'
import { createTestClient, CreateTestClientArgs } from '@hattip/adapter-test'
import { compose } from '@hattip/compose'
import { join } from 'node:path'
import { createTestContext, TestContext } from './helper.js'

describe.concurrent('client', async () => {
  let generators: TestContext

  beforeAll(async () => {
    const fixturesDir = join(__dirname, 'client/__fixtures__')
    const testDir = join(fixturesDir, 'kitchen-sink')

    generators = createTestContext({ tempDir: false })
    const generator = generators.get(testDir)
    await generator.start()
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

  test('route with a complex search parameter', async () => {
    const client = await getTestClient()

    let result = await client.getLength({ val: [1, 2, 3] })
    expect(result).toBe(3)

    result = await client.getLength({ val: 'hello' })
    expect(result).toBe(5)

    result = await client.getLength({ val: { length: 0 } })
    expect(result).toBe(0)
  })

  test('route with a paginated result', async () => {
    const client = await getTestClient()
    const spy = vi.fn()

    let response = client.streamPosts()
    for await (const value of response) {
      spy(value)
    }

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledWith(2)

    if (response.nextPage) {
      for await (const value of response.nextPage()) {
        spy(value)
      }
    }

    expect(spy).toHaveBeenCalledTimes(4)
    expect(spy).toHaveBeenCalledWith(3)
    expect(spy).toHaveBeenCalledWith(4)
  })

  test('route with a JSON request body', async () => {
    const client = await getTestClient()

    const result = await client.createPost({ title: 'hello', text: 'world' })
    expect(result).toEqual({
      title: 'hello',
      text: 'world',
    })
  })

  test('invalid JSON request body', async () => {
    const client = await getTestClient()
    await expect(client.createPost({} as any)).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [HTTPError: Expected required property
           Path: /title
          Value: undefined
        Request: POST http://example.com/posts]
    `)
  })

  test('route that throws an error', async () => {
    const client = await getTestClient()
    await expect(
      client.throwError()
    ).rejects.toThrowErrorMatchingInlineSnapshot(`[HTTPError: oops]`)
  })

  test('route that returns a raw response', async () => {
    const client = await getTestClient()
    const result = await client.rawResponse({ wild: 'sup' })
    expect(await result.text()).toBe('sup')
  })
})

async function getTestClient() {
  const clientRoutes = await import(
    './client/__fixtures__/kitchen-sink/client/generated/api.js'
  )
  const { default: serverRoutes } = await import(
    './client/__fixtures__/kitchen-sink/server/generated/api.js'
  )

  const handler = compileRoutes(serverRoutes)

  return defineClient(clientRoutes, {
    prefixUrl: 'http://example.com/',
    fetch: createTestClient({
      handler: compose(handler) as CreateTestClientArgs['handler'],
    }),
  })
}
