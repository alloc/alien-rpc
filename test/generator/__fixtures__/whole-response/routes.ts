import { route } from '@alien-rpc/service'

export const test = route.get('/test', async (): Promise<Response> => {
  return new Response('Hello, world!')
})
