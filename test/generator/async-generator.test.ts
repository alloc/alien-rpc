import { testGenerate } from './util.js'

test.concurrent('GET route with async generator', async ({ expect }) => {
  await testGenerate(
    expect,
    /* ts */ `
      import { route } from '@alien-rpc/service'

      export const streamNumbers = route.get('/numbers', async function* () {
        yield 1
        yield 2
        yield 3
      })
    `
  )
})
