import { testGenerate } from './util.js'

test.concurrent('GET route with nullable JSON result', async ({ expect }) => {
  await testGenerate(
    expect,
    /* ts */ `
      import { route } from '@alien-rpc/service'

      export const getUserById = route.get('/users/:id', async ({ id }, {}) => {
        if (id === '1') {
          return { id: 1, name: 'John' }
        }
        return null
      })
    `
  )
})
