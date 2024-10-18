import fs from 'node:fs'
import path from 'node:path'
import { diff, isString, mapValues } from 'radashi'
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
  const entry = globSync(extractPathsFromPackageExports(metadata.exports), {
    cwd: path.dirname(pkgPath),
  })
  const outDir = `dist/${metadata.name}`
  return {
    root: path.relative(process.cwd(), path.dirname(pkgPath)),
    name: metadata.name,
    version: metadata.version,
    exports: rewritePackageExports(metadata.exports, path =>
      path.replace('/dist/', '/')
    ),
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
    treeshake: 'smallest',
    plugins: [deleteOldFiles(pkg), linkPackages(pkg)],
  }))
)

type Plugin = Exclude<import('tsup').Options['plugins'], void>[number]

function deleteOldFiles(pkg: PkgData): Plugin {
  return {
    name: 'delete-old-files',
    buildEnd({ writtenFiles }) {
      const neededFiles = writtenFiles.map(file => file.name)
      const presentFiles = globSync([
        pkg.outDir + '/**',
        '!**/package.json',
        '!**/*.d.ts',
      ])

      const oldFiles = diff(presentFiles, neededFiles)
      const oldDirs = new Set<string>()

      // Remove obsolete files
      for (const file of oldFiles) {
        fs.rmSync(file)
        oldDirs.add(path.dirname(file))
      }

      // Remove empty directories
      for (let dir of oldDirs) {
        try {
          while (true) {
            // This throws if the directory is not empty
            fs.rmdirSync(dir)
            dir = path.dirname(dir)
          }
        } catch {}
      }
    },
  }
}

function linkPackages(pkg: PkgData): Plugin {
  return {
    name: 'link-packages',
    buildEnd() {
      forceRemoveSync(`${pkg.root}/dist`)

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
            exports: pkg.exports,
          })
        )

        if (pkg.dependencies.length > 0) {
          const nodeModulesDir = pkg.outFile('node_modules')
          for (const dep of pkg.dependencies) {
            const depDir = path.join(nodeModulesDir, dep)
            fs.mkdirSync(path.dirname(depDir), { recursive: true })
            fs.symlinkSync(
              path.relative(
                path.dirname(depDir),
                `${pkg.root}/node_modules/${dep}`
              ),
              depDir
            )
          }
        }

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

function extractPathsFromPackageExports(exports: PackageExports): string[] {
  return Object.values(exports).flatMap(value => {
    if (!isString(value)) {
      return extractPathsFromPackageExports(value)
    }
    return value.replace('dist/', 'src/').replace(/.js$/, '.ts')
  })
}

function rewritePackageExports(
  exports: PackageExports,
  rewrite: (path: string) => string
): PackageExports {
  return mapValues(exports, value =>
    isString(value) ? rewrite(value) : rewritePackageExports(value, rewrite)
  )
}

function forceRemoveSync(path: string) {
  try {
    fs.rmSync(path, { recursive: true, force: true })
  } catch (e: any) {
    console.error(`Failed to remove ${path}: ${e.message}`)
  }
}
