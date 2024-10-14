import { vol } from 'memfs'
import path from 'node:path'
import prettier from 'prettier'
import { uid } from 'radashi'
import create from '../src/generator.js'
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
//
// Testing utilities
//

async function generate(sourceCode: string) {
  const root = new URL('./__fixtures__/' + uid(12), import.meta.url).pathname

  vol.fromJSON({ 'routes.ts': sourceCode }, root)

  await create({
    routesFile: 'routes.ts',
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
