import { compile, ParamData, parse, Token, TokenData } from 'path-to-regexp'
import { weakMemo } from './internal/weakMemo'

type RouteLike = { method: string; path: string }

export const parseRoutePath = weakMemo<RouteLike, TokenData>(route =>
  parse(route.path)
)

export const parseRoutePathParams = weakMemo<RouteLike, string[]>(route =>
  parseRoutePath(route).tokens.flatMap(stringifyToken)
)

function stringifyToken(token: Token): string | string[] {
  switch (token.type) {
    case 'param':
    case 'wildcard':
      return token.name
    case 'group':
      return token.tokens.flatMap(stringifyToken)
    case 'text':
      return []
  }
}

const compileRoutePath = weakMemo<RouteLike, (params?: ParamData) => string>(
  route => compile(route.path)
)

export function renderRoutePath(route: RouteLike, params?: ParamData) {
  const render = compileRoutePath(route)
  return render(params)
}
