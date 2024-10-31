import { createServer } from '@hattip/adapter-node'
import handler from './handler.ts'

console.log('Starting server...')
createServer(handler).listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
