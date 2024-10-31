import { compilePaths, InferParams } from 'pathic'

interface Route {
  path: string
  render: (params: any) => Promise<Node>
}

const routes: Route[] = []

/**
 * Declare a client-side route that renders a Node.
 */
export function route<TPath extends string>(
  path: TPath,
  render: (params: InferParams<TPath>) => Promise<Node>,
) {
  routes.push({ path, render })
}

/**
 * Render the matching route into the first element matching the given
 * selector.
 */
export function render(location: { pathname: string }, selector: string) {
  document.documentElement.style.visibility = ''
  const container = document.querySelector(selector)!
  return compilePaths(routes.map((route) => route.path))(
    location.pathname,
    async (index, params) => {
      container.replaceChildren(await routes[index].render(params))
    },
  )
}
