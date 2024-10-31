import { client } from '../client.js'

const publishBtn = document.querySelector('#publish-btn')!

publishBtn.addEventListener('click', (event) => {
  event.preventDefault()

  const titleInput = document.querySelector(
    '.composer input[name="title"]',
  ) as HTMLInputElement
  const contentInput = document.querySelector(
    '.composer textarea',
  ) as HTMLTextAreaElement

  const title = titleInput.value
  const content = contentInput.value
  if (!title || !content) return

  client.createPost(
    {
      title,
      content,
    },
    {
      headers: {
        'x-publish-key': localStorage.getItem('publish-key')!,
      },
    },
  )
})
