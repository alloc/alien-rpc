import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/typebox/index.ts'],
  format: ['esm'],
  splitting: true,
})
