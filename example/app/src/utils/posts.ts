import { ResponseStream } from '@alien-rpc/client'
import { renderMarkdown } from './markdown.js'
import { renderPartial } from './partial.js'

export async function renderPostStream(
  response: ResponseStream<any>,
  container: HTMLElement,
  nextPageBtn: HTMLElement,
) {
  // Render posts as they arrive from the server.
  for await (const post of response) {
    container.append(
      renderPartial('post', {
        ...post,
        content: renderMarkdown(post.content),
        created_at: new Date(post.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      }),
    )
  }

  // If there are more posts, show the "See more posts" button.
  const { nextPage } = response
  if (nextPage) {
    nextPageBtn.style.display = 'block'
    nextPageBtn.addEventListener(
      'click',
      () => {
        nextPageBtn.style.display = 'none'
        renderPostStream(nextPage(), container, nextPageBtn)
      },
      { once: true },
    )
  }
}
