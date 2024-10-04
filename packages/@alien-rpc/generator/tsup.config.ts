import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/generator.ts'],
  format: ['esm'],
})
