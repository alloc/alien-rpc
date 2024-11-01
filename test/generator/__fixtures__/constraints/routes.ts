import { route, t } from '@alien-rpc/service'

export const testConstraints = route.get(
  '/constraints/:id',
  async (
    id: string & t.Format<'uuid'>,
    searchParams: {
      tuple?: [string, string]
      array?: string[] & t.MinItems<1> & t.MaxItems<2>
      object?: Record<string, string> & t.MinProperties<1> & t.MaxProperties<2>
      email?: string & t.Format<'email'>
      month?: string & t.Pattern<'^[0-9]{4}-(0[1-9]|1[0-2])$'>
      date?: Date & t.MinimumTimestamp<1704067200000>
    }
  ) => {}
)
