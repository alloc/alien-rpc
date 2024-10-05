/**
 * The backend defines pagination links by returning objects that are converted
 * to URL search params.
 */
export type RpcPaginationResult = {
  prev?: Record<string, any> | null
  next?: Record<string, any> | null
}
