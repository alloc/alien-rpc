import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: './test/setup.ts',
    server: {
      deps: {
        inline: ['jumpgen'],
      },
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    isolate: false,
    testTimeout: 15e3,
  },
})
