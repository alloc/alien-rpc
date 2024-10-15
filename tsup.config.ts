import fs from 'node:fs'
import path from 'node:path'
import { diff, isString } from 'radashi'
import { globSync } from 'tinyglobby'
import { defineConfig } from 'tsup'

const packages = globSync('**/package.json', {
  cwd: 'packages',
  ignore: ['cli', 'path-to-regexp', '**/typebox-codegen', '**/node_modules'],
  absolute: true,
}).map(pkgPath => {
  const metadata = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  if (!metadata.exports) {
    throw new Error(`Package ${metadata.name} has no exports`)
  }
  const entry = globSync(mapExportsToEntry(metadata.exports), {
    cwd: path.dirname(pkgPath),
  })
  const outDir = `node_modules/${metadata.name}`
  return {
    root: path.relative(process.cwd(), path.dirname(pkgPath)),
    name: metadata.name,
    version: metadata.version,
    dependencies: Object.keys(metadata.dependencies || {}).concat(
      Object.keys(metadata.peerDependencies || {})
    ),
    entry,
    outDir,
    outFile(name: string) {
      return `${outDir}/${name}`
    },
  }
})

type PkgData = (typeof packages)[number]

export default defineConfig(
  packages.map(pkg => ({
    entry: pkg.entry.map(entry => `${pkg.root}/${entry}`),
    outDir: pkg.outDir,
    format: ['esm'],
    external: pkg.dependencies,
    splitting: pkg.entry.length > 1,
    plugins: [deleteOldFiles(pkg), linkPackages(pkg)],
  }))
)

type Plugin = Exclude<import('tsup').Options['plugins'], void>[number]

function deleteOldFiles(pkg: PkgData): Plugin {
  return {
    name: 'delete-old-files',
    buildEnd({ writtenFiles }) {
      const oldFiles = diff(
        writtenFiles.map(file => file.name),
        globSync(pkg.outDir + '/**')
      )
      for (const file of oldFiles) {
        fs.rmSync(file)
      }
    },
  }
}

function linkPackages(pkg: PkgData): Plugin {
  return {
    name: 'link-packages',
    buildEnd() {
      try {
        fs.rmSync(`${pkg.root}/dist`, { recursive: true, force: true })
      } catch {}

      if (this.options.watch) {
        // Write a package.json to the generated package
        fs.mkdirSync(pkg.outDir, { recursive: true })
        fs.writeFileSync(
          pkg.outFile('package.json'),
          JSON.stringify({
            name: pkg.name,
            type: 'module',
            private: true,
            version: pkg.version,
          })
        )

        // Link the generated packages to the correct location
        try {
          fs.symlinkSync(
            path.relative(pkg.root, pkg.outDir),
            `${pkg.root}/dist`
          )
        } catch {}
      } else {
        // Move the generated packages to the correct location
        fs.renameSync(pkg.outFile('dist'), `${pkg.root}/dist`)
      }
    },
  }
}

type PackageExports = {
  [k: string]: string | PackageExports
}

function mapExportsToEntry(exports: PackageExports): string[] {
  return Object.values(exports).flatMap(value => {
    if (!isString(value)) {
      return mapExportsToEntry(value)
    }
    return value.replace('dist/', 'src/').replace(/.js$/, '.ts')
  })
}
