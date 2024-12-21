import type { Project } from '@ts-morph/bootstrap'
import type { StandardizedFilePath, ts } from '@ts-morph/common'
import type { JumpgenFS } from 'jumpgen'
import path from 'node:path'

export type TsConfigResolution = {
  readonly fileName: string
  readonly compilerOptions: ts.CompilerOptions
  readonly paths: {
    filePaths: StandardizedFilePath[]
    directoryPaths: StandardizedFilePath[]
  }
  readonly errors: ts.Diagnostic[]
}

export type TsConfigCache = ReturnType<typeof createTsConfigCache>

export function createTsConfigCache(fs: JumpgenFS, project: Project) {
  const resolveTsConfig = (configFilePath: string): TsConfigResolution => {
    return {
      ...project.resolveTsConfig(configFilePath),
      fileName: configFilePath,
    }
  }

  const configFileMap = new Map<string, TsConfigResolution>()

  return {
    findUp(fromDirectory: StandardizedFilePath) {
      let cwd: string = fromDirectory
      let config: TsConfigResolution | undefined
      while (true) {
        const configFilePath = fs.findUp('tsconfig.json', {
          absolute: true,
          cwd,
        })
        if (!configFilePath) {
          return null
        }
        fs.watch(configFilePath)
        config = configFileMap.get(configFilePath)
        if (!config) {
          config = resolveTsConfig(configFilePath)
          configFileMap.set(configFilePath, config)
        }
        if (config.paths.directoryPaths.includes(fromDirectory)) {
          return config
        }
        cwd = path.resolve(configFilePath, '../..')
      }
    },
    get(configFilePath: string) {
      return configFileMap.get(configFilePath)
    },
    invalidate(configFilePath: string) {
      configFileMap.delete(configFilePath)
    },
  }
}
