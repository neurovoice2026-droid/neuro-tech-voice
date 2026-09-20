import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A tiny in-memory stand-in for the Supabase query builder, enough for the
// kv_store calls (select/eq/maybeSingle, upsert, delete/eq).
interface FakeRow {
  key: string
  value: unknown
  expires_at: string | null
}

const supabase = vi.hoisted(() => ({
  rows: new Map<string, FakeRow>(),
  error: null as { code: string; message: string } | null,
  calls: 0,
  rpcCalls: 0,
  // Simulates a database where migration 010 (public.kv_incr) is not applied yet.
  rpcMissing: false,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    // Same semantics as public.kv_incr: one atomic upsert, TTL set only when the window starts.
    async rpc(name: string, args: { p_key: string; p_ttl_seconds: number }) {
      if (name !== 'kv_incr') throw new Error(`unexpected rpc ${name}`)
      supabase.rpcCalls++
      if (supabase.rpcMissing) {
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.kv_incr' } }
      }
      if (supabase.error) return { data: null, error: supabase.error }
      const row = supabase.rows.get(args.p_key)
      const live = row && (!row.expires_at || Date.parse(row.expires_at) > Date.now())
      const count = live && typeof row.value === 'number' ? row.value + 1 : 1
      const expiresAt = live && row.expires_at ? row.expires_at : new Date(Date.now() + args.p_ttl_seconds * 1000).toISOString()
      supabase.rows.set(args.p_key, { key: args.p_key, value: count, expires_at: expiresAt })
      return { data: count, error: null }
    },
    from(table: string) {
      if (table !== 'kv_store') throw new Error(`unexpected table ${table}`)
      supabase.calls++
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: async () =>
              supabase.error
                ? { data: null, error: supabase.error }
                : { data: supabase.rows.get(key) ?? null, error: null },
          }),
        }),
        upsert: async (row: FakeRow) => {
          if (supabase.error) return { error: supabase.error }
          supabase.rows.set(row.key, row)
          return { error: null }
        },
        delete: () => ({
          eq: async (_col: string, key: string) => {
            if (supabase.error) return { error: supabase.error }
            supabase.rows.delete(key)
            return { error: null }
          },
        }),
      }
    },
  }),
}))

import { kvDel, kvGet, kvIncr, kvSet, resetKvForTests } from './kv'

type Command = (string | number)[]

function upstashFetch(store = new Map<string, string>()) {
  const calls: Command[][] = []
  const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const commands = JSON.parse(String(init?.body)) as Command[]
    calls.push(commands)
    const results = commands.map(([name, key, ...args]) => {
      const k = String(key)
      switch (name) {
        case 'GET':
          return { result: store.get(k) ?? null }
        case 'SET':
          store.set(k, String(args[0]))
          return { result: 'OK' }
        case 'INCR': {
          const next = Number(store.get(k) ?? '0') + 1
          store.set(k, String(next))
          return { result: next }
        }
        case 'EXPIRE':
          return { result: 1 }
        case 'DEL':
          return { result: store.delete(k) ? 1 : 0 }
        default:
          return { error: `ERR unknown command ${name}` }
      }
    })
    return Response.json(results)
  })
  return { fn, calls, store }
}

function configureUpstash() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://eu1-test.upstash.io/')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'upstash-token')
}

function configureSupabase() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
}

beforeEach(() => {
  resetKvForTests()
  supabase.rows.clear()
  supabase.error = null
  supabase.calls = 0
  supabase.rpcCalls = 0
  supabase.rpcMissing = false
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Upstash backend', () => {
  it('uses the pipeline endpoint with a bearer token', async () => {
    configureUpstash()
    const upstash = upstashFetch()
    vi.stubGlobal('fetch', upstash.fn)

    await kvSet('a', { n: 1 }, 60)
    expect(await kvGet('a')).toEqual({ n: 1 })

    const [url, init] = upstash.fn.mock.calls[0]
    expect(url).toBe('https://eu1-test.upstash.io/pipeline')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer upstash-token')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(upstash.calls[0]).toEqual([['SET', 'a', '{"n":1}', 'EX', 60]])
  })

  it('sets without expiry when no ttl is given', async () => {
    configureUpstash()
    const upstash = upstashFetch()
    vi.stubGlobal('fetch', upstash.fn)
    await kvSet('a', 'text')
    expect(upstash.calls[0]).toEqual([['SET', 'a', '"text"']])
    expect(await kvGet('a')).toBe('text')
  })

  it('increments with INCR + EXPIRE NX', async () => {
    configureUpstash()
    const upstash = upstashFetch()
    vi.stubGlobal('fetch', upstash.fn)
    expect(await kvIncr('rl:x', 60)).toBe(1)
    expect(await kvIncr('rl:x', 60)).toBe(2)
    expect(upstash.calls[0]).toEqual([
      ['INCR', 'rl:x'],
      ['EXPIRE', 'rl:x', 60, 'NX'],
    ])
  })

  it('deletes keys', async () => {
    configureUpstash()
    const upstash = upstashFetch()
    vi.stubGlobal('fetch', upstash.fn)
    await kvSet('a', 1)
    await kvDel('a')
    expect(await kvGet('a')).toBeNull()
  })

  it('treats null and undefined values as deletes', async () => {
    configureUpstash()
    const upstash = upstashFetch()
    vi.stubGlobal('fetch', upstash.fn)
    await kvSet('a', 1)
    await kvSet('a', null)
    expect(upstash.calls[1]).toEqual([['DEL', 'a']])
  })
})

describe('fallbacks', () => {
  it('falls back to Supabase when Upstash fails, logging once', async () => {
    configureUpstash()
    configureSupabase()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    const warn = vi.mocked(console.warn)

    await kvSet('a', { ok: true }, 60)
    expect(supabase.rows.get('a')?.value).toEqual({ ok: true })
    expect(await kvGet('a')).toEqual({ ok: true })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][1])).toContain('upstash')
  })

  it('skips Upstash during its cooldown instead of waiting on every call', async () => {
    configureUpstash()
    configureSupabase()
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    vi.stubGlobal('fetch', failing)
    await kvGet('a')
    await kvGet('b')
    await kvIncr('c', 10)
    expect(failing).toHaveBeenCalledTimes(1)
  })

  it('treats Upstash command errors as failures', async () => {
    configureUpstash()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ error: 'WRONGPASS' }])))
    await kvSet('a', 5)
    expect(await kvGet('a')).toBe(5) // served from memory
  })

  it('treats Supabase expired rows as missing', async () => {
    configureSupabase()
    supabase.rows.set('old', { key: 'old', value: 'stale', expires_at: new Date(Date.now() - 1000).toISOString() })
    supabase.rows.set('new', { key: 'new', value: 'fresh', expires_at: new Date(Date.now() + 60_000).toISOString() })
    supabase.rows.set('forever', { key: 'forever', value: 1, expires_at: null })
    expect(await kvGet('old')).toBeNull()
    expect(await kvGet('new')).toBe('fresh')
    expect(await kvGet('forever')).toBe(1)
  })

  it('stores expires_at on Supabase writes', async () => {
    configureSupabase()
    const before = Date.now()
    await kvSet('a', [1, 2], 30)
    const row = supabase.rows.get('a')
    expect(row?.value).toEqual([1, 2])
    expect(Date.parse(String(row?.expires_at))).toBeGreaterThanOrEqual(before + 30_000)
    await kvSet('b', 'x')
    expect(supabase.rows.get('b')?.expires_at).toBeNull()
  })

  it('increments Supabase counters within a fixed window', async () => {
    configureSupabase()
    expect(await kvIncr('rl', 60)).toBe(1)
    const firstExpiry = supabase.rows.get('rl')?.expires_at
    expect(await kvIncr('rl', 60)).toBe(2)
    expect(supabase.rows.get('rl')?.expires_at).toBe(firstExpiry)
    // An expired counter restarts at 1.
    supabase.rows.set('rl', { key: 'rl', value: 9, expires_at: new Date(Date.now() - 1).toISOString() })
    expect(await kvIncr('rl', 60)).toBe(1)
  })

  it('counts through the kv_incr function when it exists', async () => {
    configureSupabase()
    expect(await kvIncr('rl', 60)).toBe(1)
    expect(await kvIncr('rl', 60)).toBe(2)
    expect(supabase.rpcCalls).toBe(2)
    // No read-then-write round trips through the table API.
    expect(supabase.calls).toBe(0)
  })

  it('falls back to read-then-write while kv_incr is missing, warning once', async () => {
    configureSupabase()
    supabase.rpcMissing = true
    const warn = vi.mocked(console.warn)
    expect(await kvIncr('rl', 60)).toBe(1)
    expect(await kvIncr('rl', 60)).toBe(2)
    expect(supabase.rows.get('rl')?.value).toBe(2)
    // The missing function is remembered: only the first increment tried it.
    expect(supabase.rpcCalls).toBe(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][1])).toContain('kv_incr')
  })

  it('falls back to memory when the kv_store table is missing', async () => {
    configureSupabase()
    supabase.error = { code: 'PGRST205', message: "Could not find the table 'public.kv_store'" }
    const warn = vi.mocked(console.warn)

    await kvSet('a', { v: 1 }, 60)
    expect(await kvGet('a')).toEqual({ v: 1 })
    expect(await kvIncr('n', 60)).toBe(1)
    expect(await kvIncr('n', 60)).toBe(2)
    await kvDel('a')
    expect(await kvGet('a')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][1])).toContain('missing_table')
    // Cooldown: only the first call reached Supabase.
    expect(supabase.calls).toBe(1)
  })

  it('never throws when every backend fails', async () => {
    configureUpstash()
    configureSupabase()
    supabase.error = { code: '500', message: 'boom' }
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('down'))))
    await expect(kvSet('a', 1)).resolves.toBeUndefined()
    await expect(kvGet('a')).resolves.toBe(1)
    await expect(kvIncr('b', 1)).resolves.toBe(1)
    await expect(kvDel('a')).resolves.toBeUndefined()
  })
})

describe('memory backend', () => {
  it('expires entries', async () => {
    vi.useFakeTimers()
    await kvSet('a', 'x', 2)
    expect(await kvGet('a')).toBe('x')
    vi.advanceTimersByTime(2001)
    expect(await kvGet('a')).toBeNull()
  })

  it('keeps a fixed window for counters', async () => {
    vi.useFakeTimers()
    expect(await kvIncr('c', 10)).toBe(1)
    vi.advanceTimersByTime(9000)
    expect(await kvIncr('c', 10)).toBe(2)
    vi.advanceTimersByTime(1001)
    expect(await kvIncr('c', 10)).toBe(1)
  })

  it('returns copies, not shared references', async () => {
    const value = { list: [1] }
    await kvSet('obj', value)
    value.list.push(2)
    const read = await kvGet<{ list: number[] }>('obj')
    expect(read).toEqual({ list: [1] })
    read?.list.push(3)
    expect(await kvGet('obj')).toEqual({ list: [1] })
  })
})
