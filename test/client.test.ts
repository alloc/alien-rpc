import { defineClient } from '@alien-rpc/client'
import { compileRoutes } from '@alien-rpc/service'
import { createTestClient, CreateTestClientArgs } from '@hattip/adapter-test'
import fs from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { globSync } from 'tinyglobby'

test('client', async () => {
  const client = await getTestClient()

  await client.getUserById('1')
})

async function getTestClient() {
  const clientFixtures = globSync('**/__fixtures__/**/client/api.ts', {
    cwd: __dirname,
    absolute: true,
  })

  const clientRoutes = (
    await Promise.all(clientFixtures.map(file => import(file)))
  ).reduce(
    (routes, mod) => Object.assign(routes, mod.routes),
    Object.create(null)
  )

  const serverFixtures = globSync('**/__fixtures__/**/server/api.ts', {
    cwd: __dirname,
    absolute: true,
  })

  const serverRoutes = (
    await Promise.all(
      serverFixtures.map(file => import(file).then(mod => mod.default))
    )
  ).flat()

  // Generate an “import barrel” for the API types.
  const apiFilePath = join(__dirname, 'generator/__fixtures__/api.d.ts')
  fs.writeFileSync(
    apiFilePath,
    clientFixtures
      .map(file => `export * from '${relativeImport(apiFilePath, file)}'`)
      .join('\n')
  )

  type API = typeof import('./generator/__fixtures__/api')

  return defineClient<API>(clientRoutes, {
    fetch: createTestClient({
      handler: compileRoutes(serverRoutes) as CreateTestClientArgs['handler'],
    }),
  })
}

function relativeImport(from: string, to: string) {
  const relativePath = relative(dirname(from), to)
  return relativePath.startsWith('../') ? relativePath : `./${relativePath}`
}
