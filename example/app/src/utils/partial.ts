import { hb } from 'mini-hb'

const partials = import.meta.glob('../partials/*.html', {
  import: 'default',
  query: '?raw',
  eager: true,
})

export function renderPartial(
  name: string,
  data?: Record<string, unknown>,
): Node {
  const html = hb(partials[`../partials/${name}.html`] as string, data ?? {})

  const staging = document.createElement('div')
  staging.innerHTML = html
  ensureScriptsCanExecute(staging)

  if (staging.childElementCount === 1) {
    return staging.firstElementChild!
  }

  const fragment = document.createDocumentFragment()
  fragment.append(...Array.from(staging.childNodes))
  return fragment
}

function ensureScriptsCanExecute(context: Element) {
  const scripts = Array.from(context.getElementsByTagName('script'))

  for (const currentScript of scripts) {
    const newScript = document.createElement('script')

    // Copy all the attributes from the original script
    for (let i = 0; i < currentScript.attributes.length; i++) {
      const a = currentScript.attributes[i]
      newScript.setAttribute(a.name, a.value)
    }
    const text = currentScript.innerHTML
    if (text) {
      newScript.appendChild(document.createTextNode(text))
    }

    currentScript.replaceWith(newScript)
  }
}
