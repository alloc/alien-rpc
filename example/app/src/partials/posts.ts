import client from '@my-app/client'
import { renderPostStream } from '../utils/posts.js'

const container = document.getElementById('posts')!
const nextPageBtn = document.getElementById('next-page')!

const { slug } = container.dataset

if (slug) {
  renderPostStream(client.streamPosts(slug), container, nextPageBtn)
}
