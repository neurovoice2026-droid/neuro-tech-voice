// The public solution pages describe the platform the reader is on: its
// billing chain must be the real one (minutes are prepaid: plans and packs,
// period reset on renewal plus the monthly roll for annual plans, auto
// top-up), never "overage reported to Stripe" (docs/billing.md).

import { describe, expect, it } from 'vitest'
import { FACTS, SAAS_PLATFORM } from '@/lib/pages/custom-saas-platforms'
import { AUTO_RUNNING } from '@/lib/pages/custom-automations'

const OVERAGE = /overage|over (the )?plan|over each allowance|past (the|each) allowance/i

/** Every string inside a value, however deep. */
function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(texts)
  if (value && typeof value === 'object') return Object.values(value).flatMap(texts)
  return []
}

describe('custom SaaS platforms page: the nightly billing steps', () => {
  it('lists the annual roll and auto top-up, not an overage report', () => {
    expect(FACTS.cronSteps).not.toContain('report_overage')
    expect(FACTS.cronSteps).not.toContain('roll_usage_periods')
    expect(FACTS.cronSteps.slice(0, 3)).toEqual(['reconcile_unbilled_calls', 'annual_usage_periods', 'auto_topup'])

    const nightly = SAAS_PLATFORM.lenses.find((l) => l.id === 'nightly')!
    const byCron = new Map(nightly.steps.filter((s) => s.cron).map((s) => [s.cron, s]))
    expect(byCron.get('auto_topup')?.text).toContain('prepaid pack')
    expect(byCron.get('annual_usage_periods')?.text).toContain('Monthly plans get theirs when Stripe renews them.')
    // Every cron step of the lens is one of the facts, in order.
    expect(nightly.steps.flatMap((s) => (s.cron ? [s.cron] : []))).toEqual([...FACTS.cronSteps])
    for (const text of texts(nightly)) expect(text).not.toMatch(OVERAGE)
  })
})

describe('custom automations page: the morning billing chain', () => {
  const morning = AUTO_RUNNING.lenses.find((l) => l.id === 'morning')!

  it('runs count, annual roll and auto top-up in order, and says minutes are prepaid', () => {
    const chain = morning.nodes.filter((n) => n.group === 'order').map((n) => n.cron)
    expect(chain).toEqual(['reconcile_unbilled_calls', 'annual_usage_periods', 'auto_topup'])
    expect(morning.foot).toContain('Minutes are prepaid, so nothing is billed after the fact.')
    expect(morning.nodes.find((n) => n.id === 'topup')?.files).toEqual(['lib/billing/auto-topup.ts'])
    // Every edge and hop points at a node or edge that exists.
    const nodeIds = new Set(morning.nodes.map((n) => n.id))
    for (const edge of morning.edges) {
      if (edge.from !== 'side') expect(nodeIds.has(edge.from), edge.id).toBe(true)
      if (edge.to !== 'side') expect(nodeIds.has(edge.to), edge.id).toBe(true)
    }
    const edgeIds = new Set(morning.edges.map((e) => e.id))
    for (const step of morning.steps) for (const hop of step.hops ?? []) expect(edgeIds.has(hop), `${step.id}: ${hop}`).toBe(true)
  })

  it('never mentions overage, in the lens or the ledger', () => {
    for (const text of texts(morning)) expect(text).not.toMatch(OVERAGE)
    for (const text of texts(AUTO_RUNNING)) expect(text).not.toMatch(OVERAGE)
  })
})
