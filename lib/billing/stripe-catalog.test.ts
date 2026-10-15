import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripe = vi.hoisted(() => ({ configured: true, ensurePlanPriceId: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/stripe/client', () => ({ isStripeConfigured: () => stripe.configured }))
vi.mock('@/lib/stripe/store-prices', () => ({ ensurePlanPriceId: stripe.ensurePlanPriceId }))

import { ensureStripePlanCatalog } from '@/lib/billing/stripe-catalog'
import { SELF_SERVE_PLANS } from '@/types'

function logger() {
  const lines: Array<{ level: string; event: string; data: unknown }> = []
  const at = (level: string) => (event: string, ...rest: unknown[]) => lines.push({ level, event, data: rest[rest.length - 1] })
  return { lines, log: { info: at('info'), warn: at('warn'), error: at('error'), debug: at('debug'), child: () => logger().log } as never }
}

beforeEach(() => {
  stripe.configured = true
  stripe.ensurePlanPriceId.mockReset().mockResolvedValue('price_from_lookup_key')
})

describe('ensureStripePlanCatalog', () => {
  it('resolves the monthly and annual price of every self-serve plan, and never a contact-sales one', async () => {
    const { log } = logger()
    const report = await ensureStripePlanCatalog(log)
    expect(report).toEqual({ checked: 16, ready: 16, failed: [] })
    const asked = stripe.ensurePlanPriceId.mock.calls.map(([plan, interval]) => `${plan}:${interval}`)
    // Every pair exactly once: the eight self-serve plans, monthly and annual.
    expect(asked).toHaveLength(16)
    expect(new Set(asked)).toEqual(new Set(SELF_SERVE_PLANS.flatMap((p) => [`${p}:month`, `${p}:year`])))
    expect(asked).toContain('growth:month')
    expect(asked).toContain('scale:year')
    expect(asked).toContain('store_growth:year')
    expect(asked.some((k) => k.startsWith('custom:') || k.startsWith('store_enterprise:') || k.startsWith('trial:'))).toBe(false)
  })

  it('one failing price never stops the others, and the report names the code, never a message or an id', async () => {
    stripe.ensurePlanPriceId.mockImplementation(async (plan: string, interval: string) => {
      if (plan === 'pro' && interval === 'year') throw Object.assign(new Error("No such price: 'price_secret123'"), { code: 'resource_missing' })
      return 'price_ok'
    })
    const { log, lines } = logger()
    const report = await ensureStripePlanCatalog(log)
    expect(report.failed).toEqual([{ plan: 'pro', interval: 'year', code: 'resource_missing' }])
    expect(report.ready).toBe(SELF_SERVE_PLANS.length * 2 - 1)
    expect(JSON.stringify([report, lines])).not.toContain('price_secret123')
  })

  it('falls back to the error type, then to a bare "error", never to the message', async () => {
    stripe.ensurePlanPriceId.mockImplementation(async (plan: string, interval: string) => {
      if (plan === 'starter' && interval === 'month') throw Object.assign(new Error('secret detail price_x'), { type: 'StripeConnectionError' })
      if (plan === 'starter' && interval === 'year') throw new Error('secret detail price_y')
      return 'price_ok'
    })
    const { log, lines } = logger()
    const report = await ensureStripePlanCatalog(log)
    expect(report.failed).toEqual([
      { plan: 'starter', interval: 'month', code: 'StripeConnectionError' },
      { plan: 'starter', interval: 'year', code: 'error' },
    ])
    expect(JSON.stringify([report, lines])).not.toContain('secret detail')
  })

  it('a Stripe call still pending at the deadline is abandoned: the run stops there and says so', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      stripe.ensurePlanPriceId.mockImplementation(() => {
        calls++
        // The third pair hangs (Stripe slow); the first two answer at once.
        return calls === 3 ? new Promise(() => {}) : Promise.resolve('price_ok')
      })
      const { log } = logger()
      const pending = ensureStripePlanCatalog(log, Date.now() + 5_000)
      await vi.advanceTimersByTimeAsync(5_001)
      const report = await pending
      expect(report).toMatchObject({ checked: 3, ready: 2, deferred: true })
      expect(report.failed).toEqual([{ plan: SELF_SERVE_PLANS[1], interval: 'month', code: 'timeout' }])
      expect(calls).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops at the deadline and says so', async () => {
    const { log } = logger()
    const report = await ensureStripePlanCatalog(log, Date.now() - 1)
    expect(report).toMatchObject({ checked: 0, ready: 0, deferred: true })
    expect(stripe.ensurePlanPriceId).not.toHaveBeenCalled()
  })

  it('does nothing without a Stripe key', async () => {
    stripe.configured = false
    const { log } = logger()
    expect(await ensureStripePlanCatalog(log)).toEqual({ checked: 0, ready: 0, failed: [], skipped: 'not_configured' })
    expect(stripe.ensurePlanPriceId).not.toHaveBeenCalled()
  })
})
