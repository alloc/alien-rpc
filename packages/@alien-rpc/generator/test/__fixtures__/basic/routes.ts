import { get, post } from '@alien-rpc/service'

// Simple GET route (nullable result)
export const getUserById = get('/users/:id', async ({ id }, {}) => {
  if (id === '1') {
    return { id: 1, name: 'John' }
  }
  return null
})

// Simple POST route
export const createUser = post(
  '/users',
  async ({}, props: { name: string }) => {
    return { id: 1 }
  }
)

type PostSort = 'title' | 'date'

// AsyncGenerator-based GET route (with pagination)
export const getPostsByUser = get(
  '/users/:id/posts',
  async function* (
    { id },
    { sort, page = 1 }: { sort?: PostSort; page?: number }
  ) {
    yield { id: 1, title: 'Post 1' }
    yield { id: 2, title: 'Post 2' }

    // Pagination
    return {
      prev: page > 1 ? { page: page - 1 } : null,
      next: { page: page + 1 },
    }
  }
)

// Generator-based GET route (with pagination)
export const generatorBasedRoute = get(
  '/generator-based-route',
  function* ({}, { page = 1 }: { page?: number }) {
    yield { id: 1, title: 'Post 1' }
    yield { id: 2, title: 'Post 2' }

    // Pagination
    return {
      prev: page > 1 ? { page: page - 1 } : null,
      next: { page: page + 1 },
    }
  }
)

export const bufferReturningRoute = get(
  '/buffer-returning-route',
  async ({}, {}) => {
    return new Uint8Array([1, 2, 3, 4, 5])
  }
)
