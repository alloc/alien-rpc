import { defineGenerator } from 'codegentool'
import path from 'path'

export default (options: {
  servicesPath: string
  schemaPath: string
}) =>
  defineGenerator(async ({ write, scan, dedent, loadModule }) => {
    const apiModules = scan('*/api.ts', { cwd: options.servicesPath })

    const schemaIndex = dedent`
      import * as API from './api'

      export { default as config } from './config'
      export * from './objects'
      export type { API }
    `

    write(path.join(options.schemaPath, 'index.ts'), schemaIndex)

    function writeServiceAPI() {
      const apiBarrel = dedent`
        ${apiModules
          .map(modulePath => {
            const importPath = '../services/' + modulePath.replace(/\.ts$/, '')
            return `export * from '${importPath}'`
          })
          .join('\n')}
      `

      write(path.join(options.schemaPath, 'api.ts'), apiBarrel)
    }

    async function writeServiceObjects() {
      const objectModules = scan(['*/objects.ts', 'core/objects/*.ts'], {
        cwd: options.servicesPath,
      })

      let imports = [`import { Static } from 'alien-rpc/typebox'`]
      let code = ''

      for (const modulePath of objectModules) {
        const exports = await loadModule(
          path.join(options.servicesPath, modulePath),
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
      write(path.join(options.schemaPath, 'objects.ts'), code)
    }

    async function writeServiceConfig() {
      // Wait for the generated API module to exist.
      if (!scan(path.join(options.schemaPath, 'api.ts')).length) return

      const API = await loadModule(path.join(options.schemaPath, 'api'), process.cwd())
      if (API !== null)
        write(
          path.join(options.schemaPath, 'config.ts'),
          'export default ' + JSON.stringify(API, null, 2) + ' as const'
        )
    }

    function writeServiceIndex() {
      const functionModules = scan('*/functions.ts', { cwd: options.servicesPath })
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

      write(path.join(options.schemaPath, 'index.ts'), indexModule)
    }

    await Promise.all([
      writeServiceAPI(),
      writeServiceObjects(),
      writeServiceConfig(),
      writeServiceIndex(),
    ])
  })
