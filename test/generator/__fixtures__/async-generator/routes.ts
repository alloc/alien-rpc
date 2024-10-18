import { route } from '@alien-rpc/service'

export const streamNumbers = route.get('/numbers', async function* () {
  yield 1
  yield 2
  yield 3
})
