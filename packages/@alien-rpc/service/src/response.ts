import { AsyncLocalStorage } from 'node:async_hooks'

export type PendingResponse = {
  status: number
  headers: Headers
}

const storage = new AsyncLocalStorage<PendingResponse>()

export const response = {
  get current(): PendingResponse | undefined {
    return storage.getStore()
  },
  set(resp: PendingResponse): void {
    storage.enterWith(resp)
  },
  run<T>(resp: PendingResponse, fn: () => T): T {
    return storage.run(resp, fn)
  },
  setHeader(name: string, value: string): void {
    const resp = this.current
    if (resp) {
      resp.headers.set(name, value)
    }
  },
  setStatus(status: number): void {
    const resp = this.current
    if (resp) {
      resp.status = status
    }
  },
}
