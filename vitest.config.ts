import os from 'os'
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
    // sequence: {
    //   concurrent: true,
    //   shuffle: true,
    // },
    isolate: false,
    testTimeout: 0,
    maxConcurrency: os.cpus().length - 1,
  },
})
