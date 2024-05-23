import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/client.ts'],
  format: ['esm'],
  splitting: true,
})
