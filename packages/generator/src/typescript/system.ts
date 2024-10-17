import { FileSystemHost, ts } from '@ts-morph/common'
import path from 'path'

export function createSystem(fs: FileSystemHost): ts.System {
  return {
    ...ts.sys,
    fileExists: fileName => fs.fileExistsSync(fileName),
    directoryExists: directory => fs.directoryExistsSync(directory),
    getCurrentDirectory: () => fs.getCurrentDirectory(),
    readDirectory: directory => fs.globSync([path.join(directory, '*')]),
    readFile: fileName => {
      try {
        return fs.readFileSync(fileName)
      } catch {
        return undefined
      }
    },
  }
}
