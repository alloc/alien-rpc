export type Post = {
  id: string
  title: string
  body: string
  author: import('./author').Author
}
