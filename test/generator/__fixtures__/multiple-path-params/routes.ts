import { route } from '@alien-rpc/service'

export const getBookByAuthor = route.get(
  '/books/:author/:title',
  async ([author, title]) => {}
)
