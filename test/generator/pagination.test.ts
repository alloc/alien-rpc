import { testGenerate } from './test-helpers.js'

test.concurrent('GET route with pagination', async ({ expect }) => {
  await testGenerate(
    expect,
    /* ts */ `
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
    `
  )
})
