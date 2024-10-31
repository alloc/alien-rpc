import { client } from '../client.js'
import { renderPartial } from '../utils/partial.js'
import { renderPostStream } from '../utils/posts.js'

const prelude = document.getElementById('prelude')!
const container = document.getElementById('posts')!
const noPostsMessage = document.getElementById('no-posts')!
const nextPageBtn = document.getElementById('next-page-btn')!

renderPostStream(client.streamTimeline(), container, nextPageBtn).then(() => {
  if (container.children.length === 0) {
    noPostsMessage.style.display = ''
  }
})

const currentUser = JSON.parse(localStorage.getItem('current-user') || 'null')

if (currentUser) {
  prelude.replaceWith(renderPartial('composer'))
} else {
  prelude.replaceWith(renderPartial('sign-up'))
}
