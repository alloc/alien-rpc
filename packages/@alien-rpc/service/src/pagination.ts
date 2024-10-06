export interface PaginationResult {
  prev?: Record<string, any> | null
  next?: Record<string, any> | null
}

export function createPaginationLink(url: URL, params: Record<string, any>) {
  url = new URL(url)
  for (const name in params) {
    url.searchParams.set(name, params[name])
  }
  return url.pathname + url.search
}
