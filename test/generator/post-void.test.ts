import { testGenerate } from './util.js'

test.concurrent('POST route with no params or response', async ({ expect }) => {
  await testGenerate(
    expect,
    /* ts */ `
      import { route } from '@alien-rpc/service'

      export const voidTest = route.post('/void', async () => {})
    `
  )
})
