import { vol } from 'memfs'
import create from '../src/generator.js'
import { dedent, recursiveRead } from './util.js'

beforeEach(() => {
  vol.reset()
})

async function generate(sourceCode: string) {
  const root = new URL('./__fixtures__/root', import.meta.url).pathname

  vol.fromJSON({ 'routes.ts': sourceCode }, root)

  await create({
    routesFile: 'routes.ts',
    outDir: '.',
  })({ root })

  const files = await recursiveRead(root, file => file !== 'routes.ts')

  return Object.entries(files)
    .map(([file, content]) => `>>>>>>> ${file}\n${dedent(content)}\n`)
    .join('\n')
}

describe('json response format', () => {
  test('get route with nullable result', async () => {
    const files = await generate(/* ts */ `
      import { route } from '@alien-rpc/service'

      export const getUserById = route.get('/users/:id', async ({ id }, {}) => {
        if (id === '1') {
          return { id: 1, name: 'John' }
        }
        return null
      })
    `)

    expect(files).toMatchInlineSnapshot(/* ts */ `
      ">>>>>>> client/api.ts
      import { RequestOptions, RequestParams } from "@alien-rpc/client";

      const API = {
        getUserById: {
          method: "get",
          path: "/users/:id",
          arity: 2,
          jsonParams: [],
          pathParams: ["id"],
          format: "json",
        },
      };

      export default API as {
        getUserById: (typeof API)["getUserById"] & {
          callee: (
            params: RequestParams<{ id: string }, Record<string, never>>,
            requestOptions?: RequestOptions,
          ) => Promise<null | { id: number; name: string }>;
        };
      };

      >>>>>>> server/api.ts
      import { Type } from "@sinclair/typebox";
      import * as routes from "../routes.js";

      export default [
        {
          def: routes.getUserById,
          requestSchema: Type.Record(Type.String(), Type.Never()),
          responseSchema: Type.Union([
            Type.Null(),
            Type.Object({
              id: Type.Number(),
              name: Type.String(),
            }),
          ]),
          jsonParams: [],
          pathParams: ["id"],
          format: "json",
        },
      ] as const;
      "
    `)
  })
})

describe('json-seq response format', () => {})

describe('plain response format', () => {})
