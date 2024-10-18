import { route } from '@alien-rpc/service'

export const complexSearch = route.get('/complex', ({}, {
  foo
}: {
  foo?: string | {bar?: string} | string[]
}) => {
  return foo
})
