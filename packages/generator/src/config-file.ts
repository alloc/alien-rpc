import type { Options as BundleRequireOptions } from 'bundle-require'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { UserConfig } from './config-types.js'

const configFileName = 'alien-rpc.config.ts'

export function findConfigFile(cwd: string): string | null {
  let currentDir = cwd

  const root = path.parse(cwd).root

  while (true) {
    const configPath = path.join(currentDir, configFileName)

    if (existsSync(configPath)) {
      return configPath
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === root) {
      return null
    }

    currentDir = parentDir
  }
}

export async function loadConfigFile(
  options: {
    root?: string
    config?: UserConfig
    configFile?: string
    noConfigBundling?: boolean
  } = {}
) {
  let config = options.config
  let configDependencies: string[] | undefined

  const root = options.root ?? process.cwd()

  if (options.configFile) {
    if (options.noConfigBundling) {
      const configModule = await import(options.configFile)
      config = configModule.default
    } else {
      const requireOptions: Partial<BundleRequireOptions> = {}
      const { bundleRequire } = await import('bundle-require')
      const { mod: configModule, dependencies } = await bundleRequire({
        ...requireOptions,
        filepath: options.configFile,
      })
      config = configModule.default
      configDependencies = dependencies.map(dep => path.resolve(dep))
    }
  }

  return {
    config: {
      ...config,
      outDir: path.resolve(root, config.outDir),
      serverOutFile: config.serverOutFile ?? 'server/generated/api.ts',
      clientOutFile: config.clientOutFile ?? 'client/generated/api.ts',
    },
    configDependencies,
  }
}

function mergeConfig(left: UserConfig | undefined, right: UserConfig) {
  if (!left) {
    return right
  }

  return {
    ...left,
    ...right,
  }
}
