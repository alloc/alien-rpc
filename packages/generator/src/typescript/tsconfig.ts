import { Project } from '@ts-morph/bootstrap'
import { JumpgenFS } from 'jumpgen'

export function findTsConfigFiles(fs: JumpgenFS, project: Project) {
  return (
    fs
      .scan('**/tsconfig.json', { absolute: true })
      .map(fileName => {
        fs.watch(fileName)
        return {
          fileName,
          depth: fileName.split('/').length - 1,
          ...project.resolveTsConfig(fileName),
        }
      })
      // Deeper configs override shallower ones
      .sort((a, b) => b.depth - a.depth)
  )
}
