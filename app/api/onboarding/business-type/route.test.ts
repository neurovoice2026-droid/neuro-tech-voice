import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, filterOf, type FakeCall, type Handler } from '@/tests/helpers/fake-db'
import { onboardingVariant } from '@/lib/commerce/business-type'

const ORG = '11111111-1111-4111-8111-111111111111'

const state: {
  user: ReturnType<typeof fakeDb> | null
  admin: ReturnType<typeof adminDb> | null
  org: Record<string, unknown>
} = { user: null, admin: null, org: {} }

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.user,
    user: { id: 'u1', email: null },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'trial' },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))

import { POST } from '@/app/api/onboarding/business-type/route'

const userHandler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { ...state.org }, error: null }
  return { data: null, error: null }
}

/** Whether the fake row passes a call's filters, as PostgREST would read them (eq, is, or of is/eq). */
function rowMatches(call: FakeCall, row: Record<string, unknown>): boolean {
  return call.filters.every(([op, column, value]) => {
    if (op === 'eq') return row[column] === value
    if (op === 'is') return (row[column] ?? null) === value
    if (op === 'or') {
      return String(value)
        .split(',')
        .some((condition) => {
          const [col, operator, ...rest] = condition.split('.')
          const operand = rest.join('.')
          if (operator === 'is' && operand === 'null') return row[col] == null
          if (operator === 'eq') return row[col] === operand
          throw new Error(`unsupported filter in the fake: ${condition}`)
        })
    }
    throw new Error(`unsupported filter in the fake: ${op}`)
  })
}

/**
 * The service-role client: a conditional UPDATE lands on the same fake row
 * only when the row passes its filters, and returns the rows it updated
 * (`.select('id')`), so the test can read the row the page would branch on.
 */
function adminDb(fail: { message: string } | null = null) {
  const calls: FakeCall[] = []
  function from(table: string) {
    const call: FakeCall = { table, op: 'select', filters: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      update: (payload: unknown) => ((call.op = 'update'), (call.payload = payload), b),
      eq: (c: string, v: unknown) => (call.filters.push(['eq', c, v]), b),
      is: (c: string, v: unknown) => (call.filters.push(['is', c, v]), b),
      or: (v: string) => (call.filters.push(['or', '', v]), b),
      select: (cols: string) => ((call.columns = cols), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        calls.push(call)
        if (fail) return Promise.resolve({ data: null, error: fail }).then(res, rej)
        const hit = call.op === 'update' && table === 'organizations' && rowMatches(call, state.org)
        if (hit) Object.assign(state.org, call.payload as Record<string, unknown>)
        return Promise.resolve({ data: hit ? [{ id: state.org.id }] : [], error: null }).then(res, rej)
      },
    }
    return b
  }
  return { from, calls }
}

// No Origin header by default (a server-side caller); the cross-site case sets one explicitly.
const post = (body: unknown, init: { origin?: string } = {}) =>
  POST(
    new Request('http://localhost/api/onboarding/business-type', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(init.origin ? { origin: init.origin } : {}) },
      body: JSON.stringify(body),
    }),
  )

const orgUpdates = () => state.admin!.calls.filter((c: FakeCall) => c.table === 'organizations' && c.op === 'update')
const userWrites = () => state.user!.calls.filter((c: FakeCall) => c.op !== 'select')

const SELECTED_AT = '2026-10-01T00:00:00Z'

/** The English refusal Step 0 shows (toast) when the type was already chosen. */
const ALREADY_SELECTED_MESSAGE = 'The business type has already been chosen and cannot be changed.'

beforeEach(() => {
  state.user = fakeDb(userHandler)
  state.admin = adminDb()
  state.org = { id: ORG, business_type: null, business_type_selected_at: null, onboarding_step: 1, onboarding_completed: false }
})

describe('POST /api/onboarding/business-type', () => {
  it('a legacy organization (backfilled services, never chose) is served the service flow untouched', () => {
    const legacy = { business_type: 'services' as const, business_type_selected_at: null }
    // The page branches on this: 'services' renders the existing OnboardingWrapper.
    expect(onboardingVariant(legacy)).toBe('services')
    // And a row from before migration 024 (no column at all) is also the service flow.
    expect(onboardingVariant({})).toBe('services')
  })

  it('a new organization must choose; picking the store flow persists through the admin client and selects ecommerce server-side', async () => {
    expect(onboardingVariant(state.org)).toBe('choose')

    const res = await post({ business_type: 'ecommerce' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ business_type: 'ecommerce', onboarding_step: 1 })

    const updates = orgUpdates()
    expect(updates).toHaveLength(1)
    expect(filterOf(updates[0], 'id')).toBe(ORG)
    // The one-time rule is part of the UPDATE itself, and the updated rows are read back.
    expect(updates[0].filters).toEqual([
      ['eq', 'id', ORG],
      ['is', 'business_type_selected_at', null],
      ['or', '', 'business_type.is.null,business_type.eq.ecommerce'],
    ])
    expect(updates[0].columns).toBe('id')
    const payload = updates[0].payload as Record<string, unknown>
    expect(payload.business_type).toBe('ecommerce')
    expect(payload.onboarding_step).toBe(1)
    expect(typeof payload.business_type_selected_at).toBe('string')
    expect(Number.isNaN(Date.parse(payload.business_type_selected_at as string))).toBe(false)
    // Nothing was written through the tenant client (the DB trigger would refuse it anyway).
    expect(userWrites()).toHaveLength(0)

    // What the page sees on the next render.
    expect(onboardingVariant(state.org)).toBe('ecommerce')
  })

  it('picking services on a legacy organization turns the backfill into an explicit choice and keeps its step', async () => {
    state.org = { ...state.org, business_type: 'services', business_type_selected_at: null, onboarding_step: 3 }
    const res = await post({ business_type: 'services' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ business_type: 'services', onboarding_step: 3 })
    expect(state.org.business_type).toBe('services')
    expect(state.org.business_type_selected_at).toEqual(expect.any(String))
    // The service onboarding in progress is not sent back to step 1.
    expect(state.org.onboarding_step).toBe(3)
    expect((orgUpdates()[0].payload as Record<string, unknown>).onboarding_step).toBeUndefined()
    expect(onboardingVariant(state.org)).toBe('services')
  })

  describe('the choice is made once (409 already_selected), even while onboarding is incomplete', () => {
    it('services → ecommerce after an explicit choice (a launched-but-unpaid services org cannot become a store)', async () => {
      state.org = { ...state.org, business_type: 'services', business_type_selected_at: SELECTED_AT, onboarding_step: 5 }
      const res = await post({ business_type: 'ecommerce' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ code: 'precondition_failed', error: ALREADY_SELECTED_MESSAGE, details: { reason: 'already_selected' } })
      expect(orgUpdates()).toHaveLength(0)
      expect(state.org).toMatchObject({ business_type: 'services', onboarding_step: 5 })
      expect(onboardingVariant(state.org)).toBe('services')
    })

    it('ecommerce → services, with or without commerce rows (the route no longer inspects connections or automations)', async () => {
      state.org = { ...state.org, business_type: 'ecommerce', business_type_selected_at: SELECTED_AT, onboarding_step: 2 }
      const res = await post({ business_type: 'services' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ details: { reason: 'already_selected' } })
      expect(orgUpdates()).toHaveLength(0)
      expect(state.org.business_type).toBe('ecommerce')
      // Only the organization row is read: the decision does not depend on store setup state.
      expect(state.user!.calls.map((c: FakeCall) => c.table)).toEqual(['organizations'])
    })

    it('re-posting the already chosen type is refused too, so a stale Step 0 tab cannot reset onboarding_step', async () => {
      state.org = { ...state.org, business_type: 'ecommerce', business_type_selected_at: SELECTED_AT, onboarding_step: 4 }
      const res = await post({ business_type: 'ecommerce' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ details: { reason: 'already_selected' } })
      expect(orgUpdates()).toHaveLength(0)
      expect(state.org.onboarding_step).toBe(4)
    })

    it('a legacy (backfilled) services organization cannot switch to the store flow', async () => {
      state.org = { ...state.org, business_type: 'services', business_type_selected_at: null, onboarding_step: 2 }
      const res = await post({ business_type: 'ecommerce' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ details: { reason: 'already_selected' } })
      expect(orgUpdates()).toHaveLength(0)
      expect(state.org).toMatchObject({ business_type: 'services', business_type_selected_at: null, onboarding_step: 2 })
    })
  })

  describe('the write is atomic: a request that loses the race answers 409 already_selected', () => {
    it('the type was chosen between the read and the write (stale read): no row is updated, nothing changes', async () => {
      // The read still sees a new sign-up, but another request has meanwhile chosen services.
      const stale = { ...state.org }
      state.user = fakeDb((c) => (c.table === 'organizations' && c.op === 'select' ? { data: stale, error: null } : { data: null, error: null }))
      state.org = { ...state.org, business_type: 'services', business_type_selected_at: SELECTED_AT, onboarding_step: 3 }
      const res = await post({ business_type: 'ecommerce' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ code: 'precondition_failed', error: ALREADY_SELECTED_MESSAGE, details: { reason: 'already_selected' } })
      expect(orgUpdates()).toHaveLength(1)
      expect(state.org).toMatchObject({ business_type: 'services', business_type_selected_at: SELECTED_AT, onboarding_step: 3 })
    })

    it('a legacy confirmation is refused when the backfill changed underneath it', async () => {
      const stale = { ...state.org, business_type: 'services', business_type_selected_at: null, onboarding_step: 2 }
      state.user = fakeDb((c) => (c.table === 'organizations' && c.op === 'select' ? { data: stale, error: null } : { data: null, error: null }))
      state.org = { ...state.org, business_type: 'ecommerce', business_type_selected_at: null, onboarding_step: 2 }
      const res = await post({ business_type: 'services' })
      expect(res.status).toBe(409)
      expect(state.org.business_type).toBe('ecommerce')
      expect(state.org.business_type_selected_at).toBeNull()
    })

    it('two concurrent choices (two tabs): exactly one wins, the other is refused', async () => {
      const [a, b] = await Promise.all([post({ business_type: 'ecommerce' }), post({ business_type: 'services' })])
      expect([a.status, b.status].sort()).toEqual([200, 409])
      const winner = a.status === 200 ? 'ecommerce' : 'services'
      expect(state.org.business_type).toBe(winner)
      expect(state.org.business_type_selected_at).toEqual(expect.any(String))
    })

    it('a database error on the write is a 500, not a silent success', async () => {
      state.admin = adminDb({ message: 'connection reset' })
      const res = await post({ business_type: 'ecommerce' })
      expect(res.status).toBe(500)
      expect(state.org.business_type).toBeNull()
    })
  })

  it('refuses any change after onboarding is completed, in English', async () => {
    state.org = { ...state.org, business_type: 'services', onboarding_completed: true }
    const res = await post({ business_type: 'ecommerce' })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: 'The business type can no longer be changed once setup is complete.',
      details: { reason: 'onboarding_completed' },
    })
    expect(orgUpdates()).toHaveLength(0)
  })

  it('validates the body (400) and rejects cross-site requests (403) before reading anything', async () => {
    expect((await post({ business_type: 'bakery' })).status).toBe(400)
    expect((await post({ business_type: 'ecommerce' }, { origin: 'https://evil.example' })).status).toBe(403)
    expect(state.user!.calls).toHaveLength(0)
    expect(orgUpdates()).toHaveLength(0)
  })

  it('reports 503 not_configured, in English, when migration 024 is not applied', async () => {
    state.user = fakeDb((c) => (c.table === 'organizations' ? { data: null, error: { message: 'column does not exist', code: '42703' } } : { data: null, error: null }))
    const res = await post({ business_type: 'ecommerce' })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'not_configured', error: 'Choosing a business type is not available yet.' })
  })
})
