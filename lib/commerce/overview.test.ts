// The store overview's minutes problem: capacity = included minutes left +
// purchased minutes (lib/billing/minute-packs.ts minutesCapacity), gated like
// the dispatcher, linking to the minutes section of the billing page.
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AGENT_A, ORG_A, asClient, commerceDb, orgRow } from '@/tests/helpers/commerce'
import { buildOverview } from './overview'

function seed(org: Record<string, unknown>) {
  return commerceDb({
    organizations: [orgRow(ORG_A, org)],
    agents: [{ id: AGENT_A, org_id: ORG_A, name: 'Maria', is_active: true, created_at: 'x' }],
    phone_numbers: [{ id: 'num-1', org_id: ORG_A, is_active: true, supports_outbound: true }],
    commerce_connections: [],
    commerce_automation_runs: [],
  })
}

async function minutesProblem(org: Record<string, unknown>) {
  const dto = await buildOverview(asClient(seed(org)), { id: ORG_A, plan: (org.plan as string | undefined) ?? 'pro' }, 'Shop')
  return dto.problems.find((p) => p.code === 'minutes_exhausted') ?? null
}

describe('store overview: minutes', () => {
  it('reports a paid plan out of included and purchased minutes, linking to buying minutes', async () => {
    const problem = await minutesProblem({ plan: 'pro', minutes_used: 1000, minutes_limit: 1000, extra_minutes_balance: 0 })
    expect(problem).toEqual({
      code: 'minutes_exhausted',
      message: 'You are out of call minutes: automated calls are paused for up to 24 hours, then skipped. Buy extra minutes or turn on auto top-up.',
      href: '/billing#minutes',
    })
  })

  it('counts purchased minutes: no problem while the balance lasts', async () => {
    expect(await minutesProblem({ plan: 'pro', minutes_used: 1200, minutes_limit: 1000, extra_minutes_balance: 1 })).toBeNull()
    expect(await minutesProblem({ plan: 'store_starter', minutes_used: 100, minutes_limit: 350, extra_minutes_balance: 0 })).toBeNull()
  })

  it('tells a trial to choose a plan', async () => {
    const problem = await minutesProblem({ plan: 'trial', minutes_used: 5, minutes_limit: 5 })
    expect(problem?.message).toContain('Choose a plan')
    expect(problem?.href).toBe('/billing#minutes')
  })

  it('fails open like the dispatcher: unknown plan, missing limit, cap turned off', async () => {
    expect(await minutesProblem({ plan: 'free', minutes_used: 9999, minutes_limit: 10 })).toBeNull()
    expect(await minutesProblem({ plan: 'pro', minutes_used: 9999, minutes_limit: null })).toBeNull()
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'false')
    expect(await minutesProblem({ plan: 'pro', minutes_used: 1000, minutes_limit: 1000, extra_minutes_balance: 0 })).toBeNull()
  })
})
