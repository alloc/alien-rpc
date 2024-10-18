import { testGenerate } from '../test-helpers.js'

test.concurrent('complex search parameter', async ({ expect }) => {
  await testGenerate(
    expect,
    /* ts */ `
      import { route } from '@alien-rpc/service'

      export const complexSearch = route.get('/complex', ({}, {
        foo
      }: {
        foo?: string | {bar?: string} | string[]
      }) => {
        return foo
      })
    `
  )
})
