import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import type { Organization } from '@/types'
import {
  addMonthsClamped,
  buildUsageSummary,
  estimateOverageUsd,
  meterEventDefinitelyRejected,
  meterEventTimestamp,
  monthlyPeriodContaining,
  OVERAGE_RESEND_WINDOW_MS,
  overageClaimValue,
  overageRowAction,
  periodFromSubscription,
  trialDaysLeft,
  usageAlertLevel,
  usagePeriodFor,
} from './usage'

const d = (iso: string) => new Date(iso)
const iso = (date: Date) => date.toISOString()

describe('addMonthsClamped', () => {
  it('keeps the day and time when the target month is long enough', () => {
    expect(iso(addMonthsClamped(d('2026-01-15T08:30:00Z'), 1))).toBe('2026-02-15T08:30:00.000Z')
    expect(iso(addMonthsClamped(d('2026-11-20T00:00:00Z'), 3))).toBe('2027-02-20T00:00:00.000Z')
  })

  it('clamps month ends and recovers the anchor day afterwards (no drift)', () => {
    const anchor = d('2026-01-31T12:00:00Z')
    expect(iso(addMonthsClamped(anchor, 1))).toBe('2026-02-28T12:00:00.000Z')
    expect(iso(addMonthsClamped(anchor, 2))).toBe('2026-03-31T12:00:00.000Z')
    expect(iso(addMonthsClamped(anchor, 3))).toBe('2026-04-30T12:00:00.000Z')
  })

  it('uses Feb 29 in leap years', () => {
    expect(iso(addMonthsClamped(d('2027-12-31T00:00:00Z'), 2))).toBe('2028-02-29T00:00:00.000Z')
    expect(iso(addMonthsClamped(d('2028-01-30T00:00:00Z'), 1))).toBe('2028-02-29T00:00:00.000Z')
  })

  it('handles a Feb 29 anchor across years', () => {
    const anchor = d('2028-02-29T09:00:00Z')
    expect(iso(addMonthsClamped(anchor, 12))).toBe('2029-02-28T09:00:00.000Z')
    expect(iso(addMonthsClamped(anchor, 48))).toBe('2032-02-29T09:00:00.000Z')
    expect(iso(addMonthsClamped(anchor, 1))).toBe('2028-03-29T09:00:00.000Z')
  })

  it('goes backwards too', () => {
    expect(iso(addMonthsClamped(d('2026-03-31T00:00:00Z'), -1))).toBe('2026-02-28T00:00:00.000Z')
    expect(iso(addMonthsClamped(d('2026-01-10T00:00:00Z'), -1))).toBe('2025-12-10T00:00:00.000Z')
  })
})

describe('monthlyPeriodContaining', () => {
  it('finds the slice around now', () => {
    const period = monthlyPeriodContaining(d('2026-01-31T12:00:00Z'), d('2026-03-05T00:00:00Z'))
    expect(iso(period.start)).toBe('2026-02-28T12:00:00.000Z')
    expect(iso(period.end)).toBe('2026-03-31T12:00:00.000Z')
  })

  it('treats the boundary instant as the start of the next period', () => {
    const period = monthlyPeriodContaining(d('2026-01-15T00:00:00Z'), d('2026-02-15T00:00:00Z'))
    expect(iso(period.start)).toBe('2026-02-15T00:00:00.000Z')
    expect(iso(period.end)).toBe('2026-03-15T00:00:00.000Z')
  })

  it('handles now earlier in the month than the anchor day', () => {
    const period = monthlyPeriodContaining(d('2025-06-20T10:00:00Z'), d('2026-09-17T09:00:00Z'))
    expect(iso(period.start)).toBe('2026-08-20T10:00:00.000Z')
    expect(iso(period.end)).toBe('2026-09-20T10:00:00.000Z')
  })

  it('always contains now', () => {
    const anchor = d('2024-01-31T23:59:59Z')
    for (let day = 0; day < 800; day += 7) {
      const now = new Date(Date.UTC(2024, 0, 31 + day, 13))
      const { start, end } = monthlyPeriodContaining(anchor, now)
      expect(start.getTime()).toBeLessThanOrEqual(now.getTime())
      expect(end.getTime()).toBeGreaterThan(now.getTime())
    }
  })
})

describe('usagePeriodFor', () => {
  const fallbackAnchor = d('2026-01-01T00:00:00Z')

  it('monthly plans use the Stripe item period while it is current', () => {
    const period = usagePeriodFor({
      interval: 'month',
      itemPeriodStart: d('2026-09-03T14:00:00Z'),
      itemPeriodEnd: d('2026-10-03T14:00:00Z'),
      fallbackAnchor,
      now: d('2026-09-17T07:00:00Z'),
    })
    expect(iso(period.start)).toBe('2026-09-03T14:00:00.000Z')
    expect(iso(period.end)).toBe('2026-10-03T14:00:00.000Z')
  })

  it('monthly plans continue on the same anchor while Stripe has not renewed yet', () => {
    const period = usagePeriodFor({
      interval: 'month',
      itemPeriodStart: d('2026-08-31T10:00:00Z'),
      itemPeriodEnd: d('2026-09-30T10:00:00Z'),
      fallbackAnchor,
      now: d('2026-09-30T10:30:00Z'),
    })
    expect(iso(period.start)).toBe('2026-09-30T10:00:00.000Z')
    expect(iso(period.end)).toBe('2026-10-31T10:00:00.000Z')
  })

  it('annual plans renew minutes monthly from the anniversary', () => {
    const period = usagePeriodFor({
      interval: 'year',
      itemPeriodStart: d('2026-01-31T09:00:00Z'),
      itemPeriodEnd: d('2027-01-31T09:00:00Z'),
      fallbackAnchor,
      now: d('2026-03-01T00:00:00Z'),
    })
    expect(iso(period.start)).toBe('2026-02-28T09:00:00.000Z')
    expect(iso(period.end)).toBe('2026-03-31T09:00:00.000Z')
  })

  it('annual plans in a leap year use Feb 29', () => {
    const period = usagePeriodFor({
      interval: 'year',
      itemPeriodStart: d('2027-08-31T00:00:00Z'),
      itemPeriodEnd: d('2028-08-31T00:00:00Z'),
      fallbackAnchor,
      now: d('2028-03-15T00:00:00Z'),
    })
    expect(iso(period.start)).toBe('2028-02-29T00:00:00.000Z')
    expect(iso(period.end)).toBe('2028-03-31T00:00:00.000Z')
  })

  it('the last monthly slice of an annual plan never runs past the paid year', () => {
    // A 14-day Stripe trial leaves an item period shorter than a month.
    const period = usagePeriodFor({
      interval: 'year',
      itemPeriodStart: d('2026-09-03T00:00:00Z'),
      itemPeriodEnd: d('2026-09-17T00:00:00Z'),
      fallbackAnchor,
      now: d('2026-09-10T00:00:00Z'),
    })
    expect(iso(period.start)).toBe('2026-09-03T00:00:00.000Z')
    expect(iso(period.end)).toBe('2026-09-17T00:00:00.000Z')
  })

  it('without a Stripe period, rolls monthly from the fallback anchor', () => {
    const period = usagePeriodFor({ interval: 'month', fallbackAnchor: d('2026-05-31T00:00:00Z'), now: d('2026-06-30T12:00:00Z') })
    expect(iso(period.start)).toBe('2026-06-30T00:00:00.000Z')
    expect(iso(period.end)).toBe('2026-07-31T00:00:00.000Z')
  })

  it('a late monthly renewal follows the billing cycle anchor, not a clamped period start', () => {
    // Anchor on the 31st: Stripe's period ran Feb 28 → Mar 31, the next one is Mar 31 → Apr 30.
    const period = usagePeriodFor({
      interval: 'month',
      itemPeriodStart: d('2026-02-28T10:00:00Z'),
      itemPeriodEnd: d('2026-03-31T10:00:00Z'),
      billingCycleAnchor: d('2026-01-31T10:00:00Z'),
      fallbackAnchor,
      now: d('2026-03-31T11:00:00Z'),
    })
    expect(iso(period.start)).toBe('2026-03-31T10:00:00.000Z')
    expect(iso(period.end)).toBe('2026-04-30T10:00:00.000Z')
  })

  it('after a Stripe trial ends, the first paid period starts at the anchor (monthly and annual)', () => {
    for (const interval of ['month', 'year'] as const) {
      const period = usagePeriodFor({
        interval,
        itemPeriodStart: d('2026-09-03T08:00:00Z'),
        itemPeriodEnd: d('2026-09-17T08:00:00Z'),
        billingCycleAnchor: d('2026-09-17T08:00:00Z'),
        fallbackAnchor,
        now: d('2026-09-18T07:00:00Z'),
      })
      expect(iso(period.start)).toBe('2026-09-17T08:00:00.000Z')
      expect(iso(period.end)).toBe('2026-10-17T08:00:00.000Z')
    }
  })

  it('ignores a billing cycle anchor that does not line up with the item period', () => {
    const period = usagePeriodFor({
      interval: 'month',
      itemPeriodStart: d('2026-09-03T00:00:00Z'),
      itemPeriodEnd: d('2026-10-03T00:00:00Z'),
      billingCycleAnchor: d('2026-06-10T00:00:00Z'),
      fallbackAnchor,
      now: d('2026-10-04T00:00:00Z'),
    })
    expect(iso(period.start)).toBe('2026-10-03T00:00:00.000Z')
    expect(iso(period.end)).toBe('2026-11-03T00:00:00.000Z')
  })

  it('ignores an inverted Stripe period', () => {
    const period = usagePeriodFor({
      interval: 'month',
      itemPeriodStart: d('2026-10-01T00:00:00Z'),
      itemPeriodEnd: d('2026-09-01T00:00:00Z'),
      fallbackAnchor: d('2026-01-05T00:00:00Z'),
      now: d('2026-09-17T00:00:00Z'),
    })
    expect(iso(period.start)).toBe('2026-09-05T00:00:00.000Z')
  })
})

describe('periodFromSubscription', () => {
  it('reads the plan item period (seconds) and interval', () => {
    const subscription = {
      items: {
        data: [
          {
            id: 'si_1',
            price: { id: 'price_x', recurring: { interval: 'year', usage_type: 'licensed' } },
            current_period_start: Date.parse('2026-01-31T09:00:00Z') / 1000,
            current_period_end: Date.parse('2027-01-31T09:00:00Z') / 1000,
          },
        ],
      },
    } as unknown as Pick<Stripe.Subscription, 'items'>
    const result = periodFromSubscription(subscription, d('2026-01-01T00:00:00Z'), d('2026-04-30T10:00:00Z'))
    expect(result?.interval).toBe('year')
    expect(iso(result!.period.start)).toBe('2026-04-30T09:00:00.000Z')
    expect(iso(result!.period.end)).toBe('2026-05-31T09:00:00.000Z')
  })

  it('returns null without a plan item', () => {
    const subscription = { items: { data: [] } } as unknown as Pick<Stripe.Subscription, 'items'>
    expect(periodFromSubscription(subscription, new Date(), new Date())).toBeNull()
  })

  it('passes the billing cycle anchor (seconds) through', () => {
    const subscription = {
      billing_cycle_anchor: Date.parse('2026-09-17T08:00:00Z') / 1000,
      items: {
        data: [
          {
            id: 'si_1',
            price: { id: 'price_x', recurring: { interval: 'month', usage_type: 'licensed' } },
            current_period_start: Date.parse('2026-09-03T08:00:00Z') / 1000,
            current_period_end: Date.parse('2026-09-17T08:00:00Z') / 1000,
          },
        ],
      },
    } as unknown as Pick<Stripe.Subscription, 'items' | 'billing_cycle_anchor'>
    const result = periodFromSubscription(subscription, d('2026-01-01T00:00:00Z'), d('2026-09-20T00:00:00Z'))
    expect(iso(result!.period.start)).toBe('2026-09-17T08:00:00.000Z')
  })
})

describe('overage reporting decisions', () => {
  const ROW_ID = '5b0e6f3e-6a55-4a3c-9d7e-0c2f8d1a9b10'
  const NOW = Date.parse('2026-09-17T07:00:00Z')

  it('sends a row nobody claimed yet', () => {
    expect(overageRowAction({ id: ROW_ID, stripe_meter_event_id: null }, NOW)).toBe('send')
  })

  it('resends a claimed row only while Stripe still dedupes its identifier', () => {
    const fresh = overageClaimValue(ROW_ID, NOW - 60 * 60 * 1000)
    expect(fresh.startsWith('claim-')).toBe(true)
    expect(overageRowAction({ id: ROW_ID, stripe_meter_event_id: fresh }, NOW)).toBe('resend')
    const stale = overageClaimValue(ROW_ID, NOW - OVERAGE_RESEND_WINDOW_MS)
    expect(overageRowAction({ id: ROW_ID, stripe_meter_event_id: stale }, NOW)).toBe('review')
  })

  it('never resends a claim for another row, a claim from the future or an unknown value', () => {
    expect(overageRowAction({ id: ROW_ID, stripe_meter_event_id: overageClaimValue('other-row', NOW) }, NOW)).toBe('review')
    expect(overageRowAction({ id: ROW_ID, stripe_meter_event_id: overageClaimValue(ROW_ID, NOW + 60_000) }, NOW)).toBe('review')
    expect(overageRowAction({ id: ROW_ID, stripe_meter_event_id: ROW_ID }, NOW)).toBe('review')
  })

  it('treats only Stripe 4xx answers as certainly not recorded', () => {
    expect(meterEventDefinitelyRejected({ statusCode: 400 })).toBe(true)
    expect(meterEventDefinitelyRejected({ statusCode: 429 })).toBe(true)
    expect(meterEventDefinitelyRejected({ statusCode: 500 })).toBe(false)
    expect(meterEventDefinitelyRejected(new Error('socket hang up'))).toBe(false)
    expect(meterEventDefinitelyRejected(null)).toBe(false)
  })

  it('keeps the claim on an idempotency conflict: the first request may have recorded the event (docs F1)', () => {
    // stripe-node: 400 with type idempotency_error becomes StripeIdempotencyError.
    expect(meterEventDefinitelyRejected({ statusCode: 400, type: 'StripeIdempotencyError', rawType: 'idempotency_error' })).toBe(false)
    expect(meterEventDefinitelyRejected({ statusCode: 409 })).toBe(false)
    expect(meterEventDefinitelyRejected({ statusCode: 400, type: 'StripeInvalidRequestError', rawType: 'invalid_request_error' })).toBe(true)
  })

  it('sends the claim time as the event timestamp, so every retry and resend is identical', () => {
    const claimedAt = NOW - 3 * 60 * 60 * 1000
    const claim = overageClaimValue(ROW_ID, claimedAt)
    expect(meterEventTimestamp(claim, NOW)).toBe(Math.floor(claimedAt / 1000))
    expect(meterEventTimestamp(claim, NOW + 20 * 60 * 60 * 1000)).toBe(Math.floor(claimedAt / 1000))
    // Unreadable or future claims fall back to now.
    expect(meterEventTimestamp('garbage', NOW)).toBe(Math.floor(NOW / 1000))
    expect(meterEventTimestamp(overageClaimValue(ROW_ID, NOW + 10 * 60 * 1000), NOW)).toBe(Math.floor(NOW / 1000))
  })
})

describe('usageAlertLevel', () => {
  it('is null below 80 %', () => {
    expect(usageAlertLevel(0, 150)).toBeNull()
    expect(usageAlertLevel(119, 150)).toBeNull()
  })

  it('reaches 80 % exactly at the threshold (integer math, no float drift)', () => {
    expect(usageAlertLevel(120, 150)).toBe(80)
    expect(usageAlertLevel(4, 5)).toBe(80)
    expect(usageAlertLevel(680, 850)).toBe(80)
  })

  it('reports 100 % at and past the limit, even when one call jumps over 80 %', () => {
    expect(usageAlertLevel(5, 5)).toBe(100)
    expect(usageAlertLevel(3, 5)).toBeNull()
    expect(usageAlertLevel(9, 5)).toBe(100)
    expect(usageAlertLevel(1750, 1750)).toBe(100)
  })

  it('ignores a zero or negative limit', () => {
    expect(usageAlertLevel(10, 0)).toBeNull()
    expect(usageAlertLevel(10, -5)).toBeNull()
  })
})

describe('estimateOverageUsd / trialDaysLeft', () => {
  it('rounds overage to cents', () => {
    expect(estimateOverageUsd(7, 0.22)).toBe(1.54)
    expect(estimateOverageUsd(3, 0.25)).toBe(0.75)
    expect(estimateOverageUsd(0, 0.25)).toBe(0)
    expect(estimateOverageUsd(10, 0)).toBe(0)
  })

  it('counts whole trial days left, rounding up', () => {
    const now = d('2026-09-17T10:00:00Z')
    expect(trialDaysLeft('2026-09-20T09:00:00Z', now)).toBe(3)
    expect(trialDaysLeft('2026-09-17T10:00:01Z', now)).toBe(1)
    expect(trialDaysLeft('2026-09-17T10:00:00Z', now)).toBe(0)
    expect(trialDaysLeft('2026-09-01T00:00:00Z', now)).toBe(0)
    expect(trialDaysLeft(null, now)).toBeNull()
    expect(trialDaysLeft('not a date', now)).toBeNull()
  })
})

describe('buildUsageSummary', () => {
  const NOW = d('2026-09-17T10:00:00Z')
  type SummaryOrg = Parameters<typeof buildUsageSummary>[0]
  const base: SummaryOrg = {
    plan: 'starter',
    minutes_used: 160,
    minutes_limit: 150,
    trial_ends_at: null,
    onboarding_completed: true,
    billing_interval: 'month',
    usage_period_start: '2026-09-03T14:00:00+00:00',
    usage_period_end: '2026-10-03T14:00:00+00:00',
    created_at: '2026-01-01T00:00:00+00:00',
  } satisfies Partial<Organization>

  it('paid plan past its allowance: overage from the ledger with the plan rate', () => {
    const summary = buildUsageSummary(base, { minutes: 10, reportedMinutes: 4 }, NOW)
    expect(summary).toMatchObject({
      plan: 'starter',
      periodKind: 'billing',
      minutesRemaining: 0,
      percentUsed: 100,
      overageAllowed: true,
      overageRate: 0.25,
      overageMinutes: 10,
      estimatedOverageUsd: 2.5,
      overageSource: 'ledger',
      overageMinutesReported: 4,
      blockReason: null,
      trialDaysLeft: null,
    })
  })

  it('says overage reaches the invoice only when metered billing is set up', () => {
    expect(buildUsageSummary(base, null, NOW).overageInvoiced).toBe(false)
    expect(buildUsageSummary(base, null, NOW, { overageInvoiced: true }).overageInvoiced).toBe(true)
    expect(buildUsageSummary({ ...base, plan: 'trial' }, null, NOW, { overageInvoiced: true }).overageInvoiced).toBe(false)
  })

  it('falls back to used − limit when the ledger could not be read', () => {
    const summary = buildUsageSummary({ ...base, minutes_used: 163 }, null, NOW)
    expect(summary.overageMinutes).toBe(13)
    expect(summary.overageSource).toBe('estimate')
  })

  it('trial: no overage, trial period and days left, paused at the limit', () => {
    const trial = {
      ...base,
      plan: 'trial' as const,
      minutes_used: 5,
      minutes_limit: 5,
      billing_interval: null,
      usage_period_start: null,
      usage_period_end: null,
      trial_ends_at: '2026-09-20T09:00:00+00:00',
    }
    const summary = buildUsageSummary(trial, null, NOW)
    expect(summary).toMatchObject({
      isTrial: true,
      periodKind: 'trial',
      periodStart: trial.created_at,
      periodEnd: trial.trial_ends_at,
      overageAllowed: false,
      overageRate: 0,
      overageMinutes: 0,
      trialDaysLeft: 3,
      blockReason: 'minutes_exhausted',
    })
  })

  it('expired trial is reported as trial_expired', () => {
    const summary = buildUsageSummary(
      { ...base, plan: 'trial', minutes_used: 1, minutes_limit: 5, trial_ends_at: '2026-09-01T00:00:00Z' },
      null,
      NOW
    )
    expect(summary.blockReason).toBe('trial_expired')
    expect(summary.trialDaysLeft).toBe(0)
  })

  it('paid plan before its first period is set', () => {
    const summary = buildUsageSummary({ ...base, minutes_used: 20, usage_period_start: null, usage_period_end: null }, null, NOW)
    expect(summary.periodKind).toBe('none')
    expect(summary.percentUsed).toBe(13)
    expect(summary.minutesRemaining).toBe(130)
  })
})
