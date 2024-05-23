import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['index.ts', 'typebox/index.ts'],
  format: ['esm'],
  splitting: true,
  outDir: '../dist',
})
