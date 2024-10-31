import createClient from '@my-app/client'

export const client = createClient({
  prefixUrl: (import.meta.env.DEV ? 'http://localhost:3000' : '') + '/api/',
})
