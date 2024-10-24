import os from 'os'
import { defineConfig } from 'vitest/config'

const resolve = (path: string) => new URL(import.meta.resolve(path)).pathname

const alias = {
  '@alien-rpc/client': resolve('./packages/client/src/index.ts'),
  '@alien-rpc/service': resolve('./packages/service/src/index.ts'),
  '@alien-rpc/generator': resolve('./packages/generator/src/generator.ts'),
}

console.log(alias)

export default defineConfig({
  test: {
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    isolate: false,
    testTimeout: 0,
    maxConcurrency: os.cpus().length - 1,
    forceRerunTriggers: ['**/__fixtures__/**/routes.ts', '!**/tmp-*/routes.ts'],
    alias,
  },
  server: {
    watch: {
      ignored: ['**/__fixtures__/**/tsconfig.json'],
    },
  },
})
