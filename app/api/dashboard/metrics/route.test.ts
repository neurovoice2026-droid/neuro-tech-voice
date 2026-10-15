import { beforeEach, describe, expect, it, vi } from 'vitest'

// GET /api/dashboard/metrics: the answered rate's and the average duration's
// denominators (finished_calls, completed_calls) travel with the rates, so the
// dashboard shows "—" instead of 0% and 0s while there is nothing to divide by.

type Result = { data: unknown; error: unknown; count?: number | null }
let callRows: Array<Record<string, unknown>> = []

function fakeDb() {
  return {
    from(table: string) {
      const ops: unknown[][] = []
      const result = (): Result => {
        if (table === 'organizations') return { data: { minutes_used: 2, minutes_limit: 30, extra_minutes_balance: 0 }, error: null }
        // Only the first page of call facts holds rows.
        const range = ops.find((o) => o[0] === 'range')
        if (range && range[1] !== 0) return { data: [], error: null }
        return { data: callRows, error: null, count: callRows.length }
      }
      const builder: unknown = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(result).then(res, rej)
          return (...args: unknown[]) => { ops.push([prop, ...args]); return builder }
        },
      })
      return builder
    },
  }
}

vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({ supabase: fakeDb(), user: { id: 'u1' }, org: { id: 'org1', timezone: 'UTC', plan: 'trial' } })),
}))

import { GET } from '@/app/api/dashboard/metrics/route'

const call = (status: string, duration: number) => {
  const now = new Date().toISOString()
  return { status, sentiment: null, duration_seconds: duration, started_at: now, created_at: now, call_successful: null, outcome: null }
}

async function metrics() {
  const res = await GET(new Request('https://app.test/api/dashboard/metrics'))
  expect(res.status).toBe(200)
  return res.json()
}

beforeEach(() => {
  callRows = []
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('dashboard metrics denominators', () => {
  it('no calls: both denominators are 0 (the rates stay 0 for older clients)', async () => {
    expect(await metrics()).toMatchObject({ total_calls: 0, finished_calls: 0, completed_calls: 0, success_rate: 0, avg_duration_seconds: 0 })
  })

  it('live calls are not finished; only completed calls count towards the average', async () => {
    callRows = [call('completed', 60), call('completed', 120), call('no-answer', 0), call('failed', 5), call('in-progress', 30), call('ringing', 0)]
    expect(await metrics()).toMatchObject({ total_calls: 6, finished_calls: 4, completed_calls: 2, success_rate: 50, avg_duration_seconds: 90 })
  })

  it('finished calls with none completed: a real 0% rate, no average', async () => {
    callRows = [call('no-answer', 0), call('busy', 0)]
    expect(await metrics()).toMatchObject({ finished_calls: 2, completed_calls: 0, success_rate: 0 })
  })
})
