import fs from 'fs/promises'
import * as htmlparser2 from 'htmlparser2'
import { camel } from 'radashi'
import { defineConfig, Plugin, ViteDevServer } from 'vite'

export default defineConfig({
  plugins: [htmlPartials()],
})

function htmlPartials(): Plugin {
  let server: ViteDevServer | undefined

  const partials = new Map<string, string>()

  return {
    name: 'html-partials',
    enforce: 'pre',
    configureServer(s) {
      server = s
    },
    async resolveId(source, importer, options) {
      if (source.includes('.html?raw')) {
        const resolved = await this.resolve(
          source.replace('.html?raw', '.html'),
          importer,
          options,
        )
        if (resolved) {
          const virtualId = resolved.id + '?lang=js'
          partials.set(virtualId, resolved.id)
          return virtualId
        }
      }
    },
    async load(id) {
      if (partials.has(id)) {
        const htmlFile = partials.get(id)!

        let html = await fs.readFile(htmlFile, 'utf-8')

        const parsed = htmlparser2.parseDocument(html)
        const imports = new Set<string>()

        const traverse = (node: any) => {
          if (node.type === 'script' && node.attribs.src) {
            imports.add(node.attribs.src)
          }
          if (
            node.type === 'tag' &&
            node.name === 'link' &&
            node.attribs.href
          ) {
            imports.add(node.attribs.href)
          }
          if (node.children) {
            node.children.forEach(traverse)
          }
        }

        traverse(parsed)

        const relativeImports = [...imports].filter(
          (url) => !url.startsWith('/') && !url.startsWith('http'),
        )

        if (relativeImports.length) {
          const importsMap = new Map<string, string>()
          const importsCode = relativeImports
            .map((url) => {
              const name =
                camel(url.replace(/^\.\.?\//, '').replace(/\//g, '_')) + 'URL'

              importsMap.set(url, name)

              return `import ${name} from ${JSON.stringify(url + '?url')}`
            })
            .join('\n')

          html = html.replace(/(src|href)="(.+?)"/g, (match, attr, url) => {
            if (importsMap.has(url)) {
              return `${attr}="\${${importsMap.get(url)}}"`
            }
            return match
          })

          return `${importsCode}\n\nexport default \`${html.replace(/`/g, '\\`')}\``
        }

        return `export default ${JSON.stringify(html)}`
      }
    },
  }
}
