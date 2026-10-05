/* Minimal chainable Supabase query-builder fake for route tests. */
export interface FakeCall {
  table: string
  op: 'select' | 'update' | 'insert' | 'upsert' | 'delete'
  columns?: string
  payload?: unknown
  filters: Array<[string, string, unknown]>
}

export type Handler = (call: FakeCall) => { data: unknown; error: { message: string; code?: string } | null }

export function fakeDb(handler: Handler) {
  const calls: FakeCall[] = []
  const rpcCalls: Array<{ fn: string; args: unknown }> = []
  function from(table: string) {
    const call: FakeCall = { table, op: 'select', filters: [] }
    const resolve = () => {
      calls.push(call)
      return Promise.resolve(handler(call))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: (cols?: string) => {
        if (call.op === 'select') call.columns = cols
        return b
      },
      update: (p: unknown) => ((call.op = 'update'), (call.payload = p), b),
      insert: (p: unknown) => ((call.op = 'insert'), (call.payload = p), b),
      upsert: (p: unknown) => ((call.op = 'upsert'), (call.payload = p), b),
      delete: () => ((call.op = 'delete'), b),
      eq: (c: string, v: unknown) => (call.filters.push(['eq', c, v]), b),
      neq: (c: string, v: unknown) => (call.filters.push(['neq', c, v]), b),
      in: (c: string, v: unknown) => (call.filters.push(['in', c, v]), b),
      lt: (c: string, v: unknown) => (call.filters.push(['lt', c, v]), b),
      or: (v: string) => (call.filters.push(['or', '', v]), b),
      order: () => b,
      limit: () => b,
      single: resolve,
      maybeSingle: resolve,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => resolve().then(res, rej),
    }
    return b
  }
  return {
    from,
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: 2, error: null })
    },
    calls,
    rpcCalls,
  }
}

export function filterOf(call: FakeCall, column: string): unknown {
  return call.filters.find(([, c]) => c === column)?.[2]
}
