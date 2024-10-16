import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: './test/setup.ts',
    server: {
      deps: {
        inline: ['@alien-rpc/generator', 'jumpgen'],
      },
    },
    testTimeout: 10e3,
  },
})
