import { route } from '@alien-rpc/service'
import type { Post } from './post'

export const getPost = route.get(
  '/posts/:id',
  async (id: string): Promise<Post> => {
    return {
      id,
      title: 'Hello World',
      body: 'This is a post',
      author: {
        id: '1',
        name: 'John Doe',
      },
    }
  }
)
