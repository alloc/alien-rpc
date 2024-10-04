import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsup'

const packages = fs
  .readdirSync('packages/@alien-rpc')
  .filter(p => !p.startsWith('.'))

const srcPackage = (name: string) => `packages/@alien-rpc/${name}`
const distPackage = (name: string) => `node_modules/@alien-rpc/${name}`

export default defineConfig({
  entry: Object.fromEntries(
    packages.map(
      name =>
        [distPackage(`${name}/index`), srcPackage(`${name}/mod.ts`)] as const
    )
  ),
  plugins: [linkPackages()],
})

type Plugin = Exclude<import('tsup').Options['plugins'], void>[number]

function linkPackages(): Plugin {
  return {
    name: 'link-packages',
    buildEnd() {
      if (this.options.watch) {
        for (const name of packages) {
          const metadata = JSON.parse(
            fs.readFileSync(srcPackage(`${name}/package.json`), 'utf8')
          )

          // Write a package.json to the generated package
          fs.writeFileSync(
            distPackage(`${name}/package.json`),
            JSON.stringify({
              name: `@alien-rpc/${name}`,
              type: 'module',
              private: true,
              version: metadata.version,
              exports: metadata.exports,
            })
          )

          // Link the generated packages to the correct location
          fs.unlinkSync(srcPackage(`${name}/dist`))
          fs.symlinkSync(
            path.relative(srcPackage(name), distPackage(name)),
            srcPackage(`${name}/dist`)
          )
        }
      } else {
        // Move the generated packages to the correct location
        for (const name of packages) {
          fs.unlinkSync(srcPackage(`${name}/dist`))
          fs.renameSync(distPackage(`${name}/dist`), srcPackage(`${name}/dist`))
        }
      }
    },
  }
}
