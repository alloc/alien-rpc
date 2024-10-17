import { testGenerate } from './util.js'

test.concurrent('GET route with imported type', async ({ expect }) => {
  await testGenerate(
    expect,
    /* ts */ `
      import { route } from '@alien-rpc/service'
      import type { Post } from './post'

      export const getPost = route.get('/posts/:id', async ({ id }): Promise<Post> => {
        return {
          id,
          title: 'Hello World',
          body: 'This is a post',
          author: {
            id: '1',
            name: 'John Doe',
          },
        }
      })
    `,
    {
      files: {
        'post.ts': /* ts */ `
          export type Post = {
            id: string
            title: string
            body: string
            author: import('./author').Author
          }
        `,
        'author.ts': /* ts */ `
          export type Author = {
            id: string
            name: string
          }
        `,
      },
    }
  )
})
