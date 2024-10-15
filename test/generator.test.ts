import create, { Options } from '@alien-rpc/generator'
import { vol } from 'memfs'
import path from 'node:path'
import prettier from 'prettier'
import { uid } from 'radashi'
import { prefer, recursiveRead } from './util.js'

beforeEach(() => {
  vol.reset()
})

test('POST route with JSON payload', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    declare const db: any

    export const createUser = route.post('/users', async ({}, { name }: { name: string }) => {
      const id: number = await db.createUser({ name })
      return id
    })
  `)
})

test('POST route with no params or response', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    export const voidTest = route.post('/void', async () => {})
  `)
})

test('GET route with nullable JSON result', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    export const getUserById = route.get('/users/:id', async ({ id }, {}) => {
      if (id === '1') {
        return { id: 1, name: 'John' }
      }
      return null
    })
  `)
})

test('complex search parameter', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    export const complexSearch = route.get('/complex', ({}, {
      foo
    }: {
      foo?: string | {bar?: string} | string[]
    }) => {
      return foo
    })
  `)
})

test('search parameter as a string literal union', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    type PostSortOrder = 'asc' | 'desc'
    type PostSortKey = 'title' | 'date'
    type PostSort = {
      order: PostSortOrder
      key: PostSortKey
    }

    type Post = {
      id: number
      title: string
      content: string
    }

    declare const db: {
      getPosts: (sort: PostSort) => Promise<Post[]>
    }

    export const getSortedPosts = route.get('/posts', ({}, opts: PostSort) => {
      return db.getPosts(opts)
    })
  `)
})

test('GET route with async generator', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    export const streamNumbers = route.get('/numbers', async function* () {
      yield 1
      yield 2
      yield 3
    })
  `)
})

test('GET route with pagination', async () => {
  await generate(/* ts */ `
    import { route, paginate } from '@alien-rpc/service'

    type Post = {
      id: number
      title: string
      content: string
    }

    declare const db: {
      countPosts: () => Promise<number>
      streamPosts: (args: {page: number; limit: number}) => AsyncGenerator<Post, void, unknown>
    }

    export const paginatedNumbers = route.get(
      '/posts',
      async function* (
        {},
        { page = 1, limit = 10 }: { page?: number; limit?: number }
      ) {
        yield* db.streamPosts({ page, limit })

        const postCount = await db.countPosts()
        return paginate(this, {
          prev: page > 1 ? { page: page - 1, limit } : null,
          next:
            page < Math.ceil(postCount / limit) ? { page: page + 1, limit } : null,
        })
      }
    )
  `)
})

test('copy documentation to client definitions', async () => {
  await generate(/* ts */ `
    import { route } from '@alien-rpc/service'

    /**
     * Get "foo" from the server.
     * 
     * @returns "foo"
     * @see https://en.wikipedia.org/wiki/Foo_(disambiguation)
     */
    export const foo = route.get('/foo', () => {
      return 'foo'
    })
  `)
})

test('versioned API', async () => {
  await generate(
    /* ts */ `
      import { route } from '@alien-rpc/service'

      export const funFact = route.get('/fun-fact', () => {
        const funFacts = [
          "Bananas are berries, but strawberries aren't!",
          "A group of flamingos is called a 'flamboyance'.",
          "The shortest war in history lasted 38 minutes.",
          "Cows have best friends and get stressed when separated.",
          "The Hawaiian pizza was invented in Canada.",
        ];
        return funFacts[Math.floor(Math.random() * funFacts.length)];
      })
    `,
    { version: 'v1' }
  )
})

//
// Testing utilities
//

async function generate(sourceCode: string, options?: Partial<Options>) {
  const root = new URL('./__fixtures__/' + uid(12), import.meta.url).pathname

  vol.fromJSON({ 'routes.ts': sourceCode }, root)

  await create({
    ...options,
    include: 'routes.ts',
    outDir: '.',
  })({ root })

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
  ).then(files => '// @ts-nocheck\n\n' + files.join('\n'))

  expect(output).toMatchFileSnapshot(snapshotFile())
}

function snapshotFile() {
  return path.join(
    '__snapshots__',
    expect.getState().currentTestName!.replace(/\W+/g, '_') + '.ts'
  )
}
