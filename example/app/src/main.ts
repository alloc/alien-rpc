import { renderPartial } from './utils/partial.js'
import { render, route } from './utils/router.js'

route('/', async () => {
  return renderPartial('home')
})

route('/:slug', async ({ slug }) => {
  return renderPartial('posts', { slug })
})

render(location, 'main')
