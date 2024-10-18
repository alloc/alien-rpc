import { defineConfig } from 'vitest/config'

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
    testTimeout: 15e3,
  },
})
