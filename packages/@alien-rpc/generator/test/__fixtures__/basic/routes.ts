import { paginate, route } from '@alien-rpc/service'

// Simple GET route (nullable result)
export const getUserById = route.get('/users/:id', async ({ id }, {}) => {
  if (id === '1') {
    return { id: 1, name: 'John' }
  }
  return null
})

// Simple POST route
export const createUser = route.post(
  '/users',
  async ({}, props: { name: string }) => {
    return { id: 1 }
  }
)

type PostSort = 'title' | 'date'

// Generator-based GET route (without pagination)
export const getPostsByUser = route.get(
  '/users/:id/posts',
  async function* ({ id }, { sort }: { sort?: PostSort }) {
    yield { id: 1, title: 'Post 1' }
    yield { id: 2, title: 'Post 2' }
  }
)

// Generator-based GET route (with pagination)
export const getTopPostsPaginated = route.get(
  '/posts/top',
  async function* ({}, { page = 1 }: { page?: number }) {
    yield { id: 1, title: 'Post 1' }
    yield { id: 2, title: 'Post 2' }

    return paginate(this, {
      prev: page > 1 ? { page: page - 1 } : null,
      next: { page: page + 1 },
    })
  }
)

// Response-based GET route
export const getResponse = route.get(
  '/response',
  async ({}, {}): Promise<Response> => {
    return new Response('Not implemented', { status: 500 })
  }
)
