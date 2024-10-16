import { testGenerate } from './util.js'

test.concurrent(
  'GET route that returns a whole Response object',
  async ({ expect }) => {
    await testGenerate(
      expect,
      /* ts */ `
        import { route } from '@alien-rpc/service'
        
        export const test = route.get('/test', async (): Promise<Response> => {
          return new Response('Hello, world!')
        })
      `
    )
  }
)
