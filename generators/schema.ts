import { defineGenerator } from 'codegentool'
import path from 'path'

const servicesPath = './backend/services'
const schemaPath = './backend/schema'

export default () =>
  defineGenerator(async ({ write, scan, dedent, loadModule }) => {
    const apiModules = scan('*/api.ts', { cwd: servicesPath })

    const schemaPackage = dedent`
    {
      "name": "@mailquest/schema",
      "type": "module",
      "version": "0.1.0",
      "private": true,
      "main": "index.ts"
    }
  `

    const schemaIndex = dedent`
    import * as API from './api'

    export { default as config } from './config'
    export * from './objects'
    export type { API }
  `

    write(`${schemaPath}/index.ts`, schemaIndex)

    function writeServiceAPI() {
      const apiBarrel = dedent`
      ${apiModules
        .map(modulePath => {
          const importPath = '../services/' + modulePath.replace(/\.ts$/, '')
          return `export * from '${importPath}'`
        })
        .join('\n')}
    `

      write(`${schemaPath}/api.ts`, apiBarrel)
    }

    async function writeServiceObjects() {
      const objectModules = scan(['*/objects.ts', 'core/objects/*.ts'], {
        cwd: servicesPath,
      })

      let imports = [`import { Static } from 'alien-rpc/typebox'`]
      let code = ''

      for (const modulePath of objectModules) {
        const exports = await loadModule(
          `${servicesPath}/${modulePath}`,
          process.cwd()
        )

        const importPath = `../services/${modulePath.replace(/\.ts$/, '')}`
        imports.push(
          `import { ${Object.keys(exports).join(', ')} } from '${importPath}'`
        )

        for (const name in exports) {
          const value = exports[name]
          if (typeof value === 'function') {
            const type = `Static<ReturnType<typeof ${name}>>`
            code += `export type ${name} = ${type}\n`
          } else if (value.type) {
            const type = `Static<typeof ${name}>`
            code += `export type ${name} = ${type}\n`
          } else {
            code += `export { ${name} } from '${importPath}'\n`
            delete exports[name]
          }
        }
      }

      code = imports.join('\n') + '\n\n' + code
      write(`${schemaPath}/objects.ts`, code)
    }

    async function writeServiceConfig() {
      // Wait for the generated API module to exist.
      if (!scan(`${schemaPath}/api.ts`).length) return

      const API = await loadModule(`${schemaPath}/api`, process.cwd())
      if (API !== null)
        write(
          `${schemaPath}/config.ts`,
          'export default ' + JSON.stringify(API, null, 2) + ' as const'
        )
    }

    function writeServiceIndex() {
      const functionModules = scan('*/functions.ts', { cwd: servicesPath })
      const functionModuleNames = functionModules.map(modulePath => {
        return path.dirname(modulePath).replace('/', '_')
      })

      const indexModule = dedent`
      import { defineHandler } from './context'

      ${functionModules
        .map((modulePath, i) => {
          const importPath = './' + modulePath.replace(/\.ts$/, '')
          return `import ${functionModuleNames[i]} from '${importPath}'`
        })
        .join('\n')}

      export default defineHandler({
        ${functionModuleNames.map(name => `...${name}`).join(',\n        ')}
      })
    `

      write(`${servicesPath}/index.ts`, indexModule)
    }

    await Promise.all([
      writeServiceAPI(),
      writeServiceObjects(),
      writeServiceConfig(),
      writeServiceIndex(),
    ])
  })
