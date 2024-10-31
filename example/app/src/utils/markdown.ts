import { MarkdownRenderer, render } from '@croct/md-lite'

const htmlRenderer: MarkdownRenderer<string> = {
  fragment: (node) => node.children.join(''),
  text: (node) => node.content,
  bold: (node) => `<b>${node.children}</b>`,
  italic: (node) => `<i>${node.children}</i>`,
  strike: (node) => `<s>${node.children}</s>`,
  code: (node) => `<code>${node.content}</code>`,
  link: (node) => `<a href="${node.href}">${node.children}</a>`,
  image: (node) => `<img src="${node.src}" alt="${node.alt}">`,
  paragraph: (node) => `<p>${node.children.join('')}</p>`,
}

export const renderMarkdown = (input: string) => render(input, htmlRenderer)
