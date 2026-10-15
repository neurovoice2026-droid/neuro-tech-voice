import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { STRIPE_TRIAL_MINUTES, includedMinutesFor } from '@/lib/billing/stripe-trial'
import TermsPage from '@/app/(legal)/terms/page'
import { PLANS, SERVICE_PLANS, STORE_PLANS } from '@/types'

describe('included minutes during the Stripe free days', () => {
  it('a trialing subscription grants at most STRIPE_TRIAL_MINUTES on every paid plan, Scale included', () => {
    expect(STRIPE_TRIAL_MINUTES).toBe(100)
    for (const plan of [...SERVICE_PLANS, ...STORE_PLANS]) {
      expect(includedMinutesFor(plan, 'trialing'), plan).toBe(Math.min(PLANS[plan].minutes_limit, STRIPE_TRIAL_MINUTES))
    }
    expect(includedMinutesFor('scale', 'trialing')).toBe(100)
  })

  it('an active subscription, or any other status, grants the plan\'s full allowance', () => {
    expect(includedMinutesFor('scale', 'active')).toBe(15000)
    expect(includedMinutesFor('growth', 'active')).toBe(1000)
    expect(includedMinutesFor('store_growth', null)).toBe(950)
    expect(includedMinutesFor('trial', 'trialing')).toBe(PLANS.trial.minutes_limit)
  })

  it('the terms say it', () => {
    const terms = renderToString(createElement(TermsPage)).replace(/<!-- -->/g, '').replace(/\s+/g, ' ')
    expect(terms).toContain('A paid plan that starts with free days includes up to 100 minutes until its first payment')
  })
})
