import { testGenerate } from '../test-helpers.js'

test.concurrent(
  'search parameter as a string literal union',
  async ({ expect }) => {
    await testGenerate(
      expect,
      /* ts */ `
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
      `
    )
  }
)
