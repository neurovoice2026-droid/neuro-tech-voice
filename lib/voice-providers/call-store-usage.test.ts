import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import type { Logger } from '@/lib/observability/logger'

// After a call's minutes are recorded (hard cap on every plan): auto top-up
// runs best-effort, then the owner gets the 80% e-mail once per period, or
// the "out of minutes" e-mail once per period when nothing is left.

const sendEmail = vi.fn()
vi.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))
const maybeAutoTopUp = vi.fn()
vi.mock('@/lib/billing/auto-topup', () => ({ maybeAutoTopUp: (...a: unknown[]) => maybeAutoTopUp(...a) }))

import { recordUsage } from './call-store'
import { callAllowance } from '@/lib/telephony/quota'
import { minutesCapacity } from '@/lib/billing/minute-packs'

const ORG = '11111111-1111-4111-8111-111111111111'

function logger(): Logger {
  const l: Record<string, unknown> = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
  l.child = () => l
  return l as unknown as Logger
}

type Row = Record<string, unknown>

/**
 * record_call_usage of migration 027: once per key; included minutes first, then the purchased
 * balance; minutes_used grows only by the minutes the balance did not cover.
 */
function rpc(fn: string, args: unknown, tables: Record<string, Row[]>) {
  if (fn !== 'record_call_usage') return { data: null, error: { message: `unexpected rpc ${fn}` } }
  const a = args as { p_org_id: string; p_key: string; p_seconds: number }
  const minutes = Math.max(0, Math.ceil(Math.max(a.p_seconds, 0) / 60))
  tables.usage_ledger ??= []
  if (tables.usage_ledger.some((r) => r.idempotency_key === a.p_key)) return { data: [{ recorded: false, minutes, minutes_used_after: null }], error: null }
  tables.usage_ledger.push({ idempotency_key: a.p_key, minutes })
  const o = tables.organizations.find((r) => r.id === a.p_org_id)!
  const used = (o.minutes_used as number) ?? 0
  const includedLeft = Math.max(((o.minutes_limit as number) ?? 0) - used, 0)
  const fromExtra = Math.min(Math.max(minutes - includedLeft, 0), (o.extra_minutes_balance as number) ?? 0)
  o.minutes_used = used + (minutes - fromExtra)
  o.extra_minutes_balance = ((o.extra_minutes_balance as number) ?? 0) - fromExtra
  return { data: [{ recorded: true, minutes, minutes_used_after: o.minutes_used }], error: null }
}

/** memoryDb ignores or(): implement the `col.is.null,col.lt."ts"` filter the notice claim uses. */
function withOrFilter(db: MemoryDb): MemoryDb {
  const from = db.from
  db.from = (t: string) => {
    const q = from(t) as unknown as { or: (expr: string) => unknown; filters: Array<(r: Row) => boolean> }
    q.or = (expr: string) => {
      const terms = expr.split(/,(?=\w+\.)/).map((term) => {
        const [col, op, ...rest] = term.split('.')
        const value = rest.join('.').replace(/^"|"$/g, '')
        if (op === 'is' && value === 'null') return (r: Row) => r[col] === null || r[col] === undefined
        if (op === 'lt') return (r: Row) => r[col] !== null && r[col] !== undefined && Date.parse(r[col] as string) < Date.parse(value)
        throw new Error(`unsupported or() term ${term}`)
      })
      q.filters.push((r) => terms.some((f) => f(r)))
      return q
    }
    return q as unknown as ReturnType<MemoryDb['from']>
  }
  return db
}

function org(over: Row = {}): Row {
  return {
    id: ORG,
    user_id: 'user-1',
    plan: 'pro',
    minutes_used: 600,
    minutes_limit: 850,
    extra_minutes_balance: 0,
    usage_period_start: '2026-10-01T00:00:00+00:00',
    minutes_exhausted_notified_at: null,
    usage_alert_notified_at: null,
    auto_topup_enabled: false,
    ...over,
  }
}

let db: MemoryDb
function seed(over: Row = {}) {
  db = withOrFilter(memoryDb({ organizations: [org(over)], usage_ledger: [] }, { rpc }))
  ;(db as unknown as { auth: unknown }).auth = { admin: { getUserById: async () => ({ data: { user: { email: 'owner@example.com' } }, error: null }) } }
  return db
}

let seq = 0
const call = (minutes: number) => recordUsage(db as never, { orgId: ORG, callId: `call-${++seq}`, seconds: minutes * 60, provider: 'elevenlabs', source: 'elevenlabs_webhook' }, logger())
const subjects = () => sendEmail.mock.calls.map((c) => (c[0] as { subject: string }).subject)

beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue(true)
  maybeAutoTopUp.mockReset().mockResolvedValue({ status: 'skipped', reason: 'disabled' })
})

describe('the 80% e-mail', () => {
  it('goes out once, on the call that crosses 80% of the included minutes', async () => {
    seed({ minutes_used: 670 })
    await call(5) // 675 of 850: below 680
    expect(subjects()).toEqual([])
    await call(15) // 690 of 850: crosses 680
    await call(5)
    expect(subjects()).toEqual(['You’ve used 81% of your included minutes'])
    expect(db.tables.organizations[0].usage_alert_notified_at).toEqual(expect.any(String))
    const mail = sendEmail.mock.calls[0][0] as { to: string; html: string }
    expect(mail.to).toBe('owner@example.com')
    expect(mail.html).toContain('#minutes')
    expect(mail.html).toContain('Buy minutes')
  })

  it('a renewal (minutes_used back to 0, a later usage_period_start) arms it again for the new period', async () => {
    seed({ minutes_used: 670 })
    await call(20)
    // What start_usage_period does on the renewal invoice.
    Object.assign(db.tables.organizations[0], { minutes_used: 0, usage_period_start: new Date(Date.now() + 1000).toISOString() })
    await call(600) // 600 of 850: below 680
    expect(subjects()).toHaveLength(1)
    await call(100)
    expect(subjects()).toHaveLength(2)
  })

  it('a trial (no billing period) gets it once', async () => {
    seed({ plan: 'trial', minutes_limit: 10, minutes_used: 7, usage_period_start: null })
    await call(1) // 8 of 10
    await call(1)
    expect(subjects()).toEqual(['You’ve used 80% of your included minutes'])
  })

  it('calls paid from purchased minutes leave the included usage alone: no second 80% e-mail, and it never reads past the limit', async () => {
    seed({ minutes_used: 670, extra_minutes_balance: 300 })
    await call(20) // crosses 680 of 850
    await call(200) // 160 included, 40 purchased: longer than the 170 minutes between 80% and 100%
    await call(30) // all purchased
    expect(db.tables.organizations[0]).toMatchObject({ minutes_used: 850, extra_minutes_balance: 230 })
    expect(subjects()).toEqual(['You’ve used 81% of your included minutes'])
  })

  it('an organization already past 80% without this period’s notice (a downgrade) is told on its next call', async () => {
    seed({ minutes_used: 700, usage_alert_notified_at: '2026-09-20T00:00:00.000Z' }) // last period's notice
    await call(1)
    await call(1)
    expect(subjects()).toEqual(['You’ve used 82% of your included minutes'])
  })

  it('one long call from below 80% into the purchased minutes still sends it, with the included usage at the limit', async () => {
    seed({ minutes_used: 600, extra_minutes_balance: 300 })
    await call(300) // 250 included, 50 purchased
    expect(db.tables.organizations[0]).toMatchObject({ minutes_used: 850, extra_minutes_balance: 250 })
    expect(subjects()).toEqual(['You’ve used 100% of your included minutes'])
    expect((sendEmail.mock.calls[0][0] as { html: string }).html).toContain('850 of 850')
  })
})

describe('purchased minutes and an in-place plan switch', () => {
  it('minutes paid from the balance are not counted again against the new plan’s included minutes', async () => {
    // Starter, included minutes all used, 300 purchased; a 300-minute call is paid from the balance.
    seed({ plan: 'starter', minutes_limit: 400, minutes_used: 400, extra_minutes_balance: 300 })
    await call(300)
    const o = db.tables.organizations[0]
    expect(o).toMatchObject({ minutes_used: 400, extra_minutes_balance: 0 })
    // The webhook applies the switch to Growth (plan and minutes_limit only, minutes_used untouched).
    o.plan = 'growth'
    o.minutes_limit = 1000
    const usage = { plan: o.plan as string, minutes_used: o.minutes_used as number, minutes_limit: o.minutes_limit as number, extra_minutes_balance: o.extra_minutes_balance as number }
    expect(minutesCapacity(usage)).toEqual({ includedLeft: 600, extra: 0, total: 600 })
    expect(callAllowance(usage)).toMatchObject({ allowed: true, capSeconds: 600 * 60 })
  })
})

describe('the out-of-minutes e-mail', () => {
  it('goes out once per period when the included and the extra minutes are all used', async () => {
    seed({ minutes_used: 845 })
    await call(10)
    expect(db.tables.organizations[0]).toMatchObject({ minutes_used: 855, extra_minutes_balance: 0 })
    await call(3)
    expect(subjects()).toEqual(['You’re out of minutes: calls are paused'])
    expect(db.tables.organizations[0].minutes_exhausted_notified_at).toEqual(expect.any(String))

    // A new period that runs out again: one more notice.
    db.tables.organizations[0].minutes_exhausted_notified_at = '2026-09-20T00:00:00.000Z'
    await call(1)
    await call(1)
    expect(subjects()).toEqual(['You’re out of minutes: calls are paused', 'You’re out of minutes: calls are paused'])
  })

  it('purchased minutes keep calls going: they are drawn after the included ones, no notice while some are left', async () => {
    // The 80% e-mail already went out this period.
    seed({ minutes_used: 845, extra_minutes_balance: 100, usage_alert_notified_at: '2026-10-05T00:00:00.000Z' })
    await call(10)
    // 5 included minutes, then 5 purchased ones: minutes_used counts only the included part.
    expect(db.tables.organizations[0]).toMatchObject({ minutes_used: 850, extra_minutes_balance: 95 })
    expect(subjects()).toEqual([])
    await call(200)
    expect(db.tables.organizations[0]).toMatchObject({ extra_minutes_balance: 0 })
    expect(subjects()).toEqual(['You’re out of minutes: calls are paused'])
  })

  it('a trial (no billing period) is told once, with a link to the plans', async () => {
    seed({ plan: 'trial', minutes_limit: 5, minutes_used: 4, usage_period_start: null })
    await call(2)
    await call(1)
    expect(subjects()).toEqual(['You’re out of minutes: calls are paused'])
    const html = (sendEmail.mock.calls[0][0] as { html: string }).html
    expect(html).toContain('/billing#plans')
    expect(html).toContain('Upgrade to Starter (400 minutes for $49/mo)')
    expect(html).not.toContain('buy=')
  })

  it('offers the next plan up of the organization’s family, or 100 minutes', async () => {
    seed({ minutes_used: 845 })
    await call(10)
    const pro = (sendEmail.mock.calls[0][0] as { html: string }).html
    expect(pro).toContain('Upgrade to Business (5,000 minutes for $499/mo)')
    expect(pro).toContain('/billing?buy=100#minutes')
    expect(pro).toContain('Buy 100 minutes for $20')

    // A store trial is offered the store ladder (organizations.business_type).
    sendEmail.mockClear()
    seed({ plan: 'trial', business_type: 'ecommerce', minutes_limit: 5, minutes_used: 4, usage_period_start: null })
    await call(2)
    expect((sendEmail.mock.calls[0][0] as { html: string }).html).toContain('Upgrade to Store Starter (350 minutes for $100/mo)')
  })

  it('nothing is sent where no cap applies: the switch is off, or the plan is unknown', async () => {
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'false')
    seed({ minutes_used: 845 })
    await call(10)
    vi.unstubAllEnvs()
    seed({ plan: 'legacy-gold', minutes_used: 845 })
    await call(10)
    seed({ plan: 'legacy-gold', minutes_used: 670 })
    await call(20)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('auto top-up after a call', () => {
  it('runs after the usage is written and before the alerts: minutes it adds prevent the notice', async () => {
    seed({ minutes_used: 845, auto_topup_enabled: true, usage_alert_notified_at: '2026-10-05T00:00:00.000Z' })
    maybeAutoTopUp.mockImplementation(async (d: MemoryDb, orgId: string) => {
      expect(d.tables.organizations[0].minutes_used).toBe(855)
      expect(orgId).toBe(ORG)
      d.tables.organizations[0].extra_minutes_balance = 500
      return { status: 'credited', minutes: 500, amountCents: 12000, invoiceId: 'in_1', balanceAfter: 500 }
    })
    await call(10)
    expect(maybeAutoTopUp).toHaveBeenCalledTimes(1)
    expect(subjects()).toEqual([])
  })

  it('its failure never fails the call write, and the alerts still run', async () => {
    seed({ minutes_used: 845 })
    maybeAutoTopUp.mockRejectedValue(new Error('organizations auto top-up read failed'))
    await expect(call(10)).resolves.toBeUndefined()
    expect(db.tables.usage_ledger).toHaveLength(1)
    expect(subjects()).toEqual(['You’re out of minutes: calls are paused'])
  })

  it('a replayed event (usage already recorded) neither tops up nor e-mails', async () => {
    seed({ minutes_used: 845 })
    const input = { orgId: ORG, callId: 'call-replayed', seconds: 600, provider: 'elevenlabs', source: 'elevenlabs_webhook' }
    await recordUsage(db as never, input, logger())
    maybeAutoTopUp.mockClear()
    sendEmail.mockClear()
    await recordUsage(db as never, input, logger())
    expect(maybeAutoTopUp).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
