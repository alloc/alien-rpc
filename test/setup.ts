import { vol } from 'memfs'

vi.mock('node:fs', async () => {
  const memfs: { fs: typeof import('node:fs') } = await vi.importActual('memfs')
  return { default: memfs.fs }
})

afterAll(() => {
  vol.reset()
})
