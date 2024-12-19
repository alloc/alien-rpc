import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript/lib/tsserverlibrary'

function init(modules: { typescript: typeof ts }) {
  return {
    create(info: ts.server.PluginCreateInfo) {
      const metadataCache: Record<string, any> = {}

      function findMetadataFile(
        dir: string,
        root = path.parse(dir).root
      ): string | null {
        const metadataPath = path.join(
          dir,
          'node_modules/.alien-rpc/metadata.json'
        )
        if (fs.existsSync(metadataPath)) {
          return metadataPath
        }
        const parentDir = path.dirname(dir)
        if (parentDir === root) {
          // Reached root
          return null
        }
        return findMetadataFile(parentDir, root)
      }

      function loadMetadata(filePath: string): any | null {
        let metadata = metadataCache[filePath]
        if (!metadata) {
          const metadataStr = fs.readFileSync(filePath, 'utf-8')
          metadata = metadataCache[filePath] = JSON.parse(metadataStr)
        }
        return metadata
      }

      // Monkey patch `getDefinitionAtPosition`
      const languageService = info.languageService
      const proxy = Object.create(languageService)

      proxy.getDefinitionAtPosition = (fileName: string, position: number) => {
        const originalResult = languageService.getDefinitionAtPosition(
          fileName,
          position
        )

        const fileDir = path.dirname(fileName)

        const metadataFile = findMetadataFile(fileDir)
        if (!metadataFile) {
          return originalResult // Fallback to original if no metadata found
        }

        // Get the function name at the current position
        const program = info.languageService.getProgram()
        if (!program) {
          return originalResult
        }

        const sourceFile = program.getSourceFile(fileName)
        if (!sourceFile) {
          return originalResult
        }

        const checker = program.getTypeChecker()

        // Helper to find the node and extract its symbol
        function findNodeAtPosition(node: ts.Node): ts.Node | undefined {
          if (position >= node.getStart() && position < node.getEnd()) {
            return node.forEachChild(findNodeAtPosition) || node
          }
          return undefined
        }

        const node = findNodeAtPosition(sourceFile)
        if (!node) {
          return originalResult
        }

        const symbol = checker.getSymbolAtLocation(node)
        if (!symbol) {
          return originalResult
        }

        const functionName = symbol.getName()

        // Look up the function in metadata
        const metadataEntry = metadata.filesByFunction[functionName]
        if (!metadataEntry) {
          return originalResult // Fallback if function is not in metadata
        }

        // Extract file and line information
        const [relativeFile, lineStr] = metadataEntry.split(':')
        const metadataDir = path.dirname(metadataFile)
        const absoluteFile = path.resolve(metadataDir, relativeFile)
        const line = parseInt(lineStr, 10) - 1 // Convert to zero-based index

        // Create custom definition result
        const customResult: ts.DefinitionInfo = {
          fileName: absoluteFile,
          textSpan: {
            start: 0,
            length: 0, // Cannot determine span from metadata alone
          },
          kind: ts.ScriptElementKind.functionElement,
          name: functionName,
          containerName: '',
          containerKind: ts.ScriptElementKind.unknown,
        }

        return [customResult]
      }

      return proxy
    },
  }
}

export = init
