import { get, post } from '@alien-rpc/service'

// Simple get route (nullable result)
export const getUserById = get('/users/:id', ({ id }, {}, request) => {
  if (id === '1') {
    return { id: 1, name: 'John' }
  }
  return null
})

// Simple post route
export const createUser = post(
  '/users',
  ({}, body: { name: string }, request) => {
    return { id: 1 }
  }
)
