import { route } from '@alien-rpc/service'

export const getUserById = route.get('/users/:id', async ({ id }, {}) => {
  if (id === '1') {
    return { id: 1, name: 'John' }
  }
  return null
})
