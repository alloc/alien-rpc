import { compileRoutes } from '@alien-rpc/service'
import { compose } from '@hattip/compose'
import API from './generated/api.ts'

export default compose(compileRoutes(API, { prefix: '/api/' }))
