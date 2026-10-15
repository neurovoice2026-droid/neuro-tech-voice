import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.db,
    user: { id: 'u1', email: 'owner@example.com' },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'pro' },
  }),
}))

import { GET } from '@/app/api/billing/minutes/route'
import type { MinutesSummaryDto } from '@/lib/billing/minutes-summary'

function org(over: Record<string, unknown> = {}) {
  return {
    id: ORG,
    plan: 'pro',
    minutes_used: 900,
    minutes_limit: 850,
    extra_minutes_balance: 320,
    usage_period_start: '2026-10-01T00:00:00+00:00',
    auto_topup_enabled: true,
    auto_topup_pack: 500,
    auto_topup_threshold: 50,
    auto_topup_failed_at: null,
    auto_topup_failure: null,
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    ...over,
  }
}

const get = () => GET(new Request('http://localhost/api/billing/minutes'))

beforeEach(() => {
  state.db = memoryDb({
    organizations: [org()],
    minute_purchases: [
      { id: 'p1', org_id: ORG, minutes: 500, amount_cents: 12000, currency: 'usd', source: 'checkout', status: 'credited', created_at: '2026-10-02T10:00:00Z', stripe_checkout_session_id: 'cs_secretish' },
      { id: 'p2', org_id: ORG, minutes: 100, amount_cents: 2500, currency: 'usd', source: 'auto_topup', status: 'failed', created_at: '2026-10-05T10:00:00Z', failure_message: 'Your card was declined.' },
      { id: 'p3', org_id: OTHER, minutes: 2500, amount_cents: 1, currency: 'usd', source: 'checkout', status: 'credited', created_at: '2026-10-06T10:00:00Z' },
    ],
  })
})

describe('GET /api/billing/minutes', () => {
  it('summarizes included and extra minutes, the packs at the plan price, auto top-up and the purchases', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = (await res.json()) as MinutesSummaryDto
    expect(body).toEqual({
      plan: 'pro',
      can_buy: true,
      // Pro sells extra minutes at $0.20 (types/index.ts PLANS, the homepage price list).
      rate_per_minute: 0.2,
      packs: [
        { minutes: 100, amount_cents: 2000, per_minute_cents: 20, discount: 0 },
        { minutes: 500, amount_cents: 9600, per_minute_cents: 19.2, discount: 0.04 },
        { minutes: 1000, amount_cents: 18400, per_minute_cents: 18.4, discount: 0.08 },
        { minutes: 2500, amount_cents: 44000, per_minute_cents: 17.6, discount: 0.12 },
      ],
      included: { used: 900, limit: 850, left: 0, period_start: '2026-10-01T00:00:00+00:00' },
      extra_balance: 320,
      total_left: 320,
      paused: false,
      auto_topup: { enabled: true, pack: 500, threshold: 50, available: true, last_failed_at: null, failure: null },
      // Newest first, this organization only, without Stripe references.
      purchases: [
        { id: 'p2', minutes: 100, amount_cents: 2500, currency: 'usd', source: 'auto_topup', status: 'failed', created_at: '2026-10-05T10:00:00Z' },
        { id: 'p1', minutes: 500, amount_cents: 12000, currency: 'usd', source: 'checkout', status: 'credited', created_at: '2026-10-02T10:00:00Z' },
      ],
    })
  })

  it('a trial cannot buy: no packs, no rate, auto top-up unavailable', async () => {
    state.db = memoryDb({ organizations: [org({ plan: 'trial', minutes_used: 2, minutes_limit: 5, extra_minutes_balance: 0, auto_topup_enabled: false, auto_topup_pack: null, auto_topup_threshold: null, stripe_customer_id: null, stripe_subscription_id: null, usage_period_start: null })], minute_purchases: [] })
    const body = (await (await get()).json()) as MinutesSummaryDto
    expect(body).toMatchObject({
      plan: 'trial',
      can_buy: false,
      rate_per_minute: null,
      packs: [],
      included: { used: 2, limit: 5, left: 3, period_start: null },
      extra_balance: 0,
      total_left: 3,
      auto_topup: { enabled: false, pack: null, threshold: null, available: false },
      purchases: [],
    })
  })

  it('a sales-led plan can buy, but auto top-up needs a Stripe subscription', async () => {
    state.db = memoryDb({ organizations: [org({ plan: 'store_enterprise', stripe_subscription_id: null })], minute_purchases: [] })
    const body = (await (await get()).json()) as MinutesSummaryDto
    expect(body.can_buy).toBe(true)
    expect(body.rate_per_minute).toBe(0.18)
    expect(body.packs[0]).toEqual({ minutes: 100, amount_cents: 1800, per_minute_cents: 18, discount: 0 })
    expect(body.auto_topup.available).toBe(false)
  })

  it('reports calls as paused only where the cap applies (callAllowance), not from total_left alone', async () => {
    state.db = memoryDb({ organizations: [org({ minutes_used: 850, extra_minutes_balance: 0 })], minute_purchases: [] })
    const out = (await (await get()).json()) as MinutesSummaryDto
    expect(out).toMatchObject({ total_left: 0, paused: true })

    // The global minute-cap switch off: nothing pauses, whatever is left.
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'false')
    try {
      expect(((await (await get()).json()) as MinutesSummaryDto)).toMatchObject({ total_left: 0, paused: false })
    } finally {
      vi.unstubAllEnvs()
    }

    // A plan value the cap fails open on.
    state.db = memoryDb({ organizations: [org({ plan: 'gold', minutes_used: 850, extra_minutes_balance: 0 })], minute_purchases: [] })
    expect(((await (await get()).json()) as MinutesSummaryDto)).toMatchObject({ total_left: 0, paused: false })
  })

  it('a database error is a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.db = memoryDb({ organizations: [], minute_purchases: [] })
    const res = await get()
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'internal' })
  })
})
