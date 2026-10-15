// The billing page itself, rendered on the server with its data hooks
// mocked: the header names the plan as its card does and prices it on the
// interval it is paid on, the cycle switch reads "Monthly | Yearly" with the
// saving after it (as on the homepage and in onboarding), and the trial card
// is offered only to the trial, never with "Downgrade" to a paying plan.

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Organization } from '@/types'

vi.mock('@/components/pricing/fonts', () => ({ planTierDisplay: { variable: 'font-plan-tier-test' } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const state: { org: Organization | null } = { org: null }
vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({ organization: state.org, isLoading: false, refetch: vi.fn() }),
}))
vi.mock('@/hooks/useMinutes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMinutes')>()),
  // The Minutes section is held by its own tests; here it stays loading.
  useMinutes: () => ({ summary: null, isLoading: true, error: null, refresh: vi.fn(), buy: vi.fn(), saveAutoTopUp: vi.fn() }),
}))

import BillingPage from '@/app/(dashboard)/billing/page'
import { useAppStore } from '@/store/useAppStore'

function org(overrides: Partial<Organization>): Organization {
  return {
    id: 'org_1',
    name: 'Acme',
    plan: 'trial',
    business_type: null,
    minutes_used: 0,
    minutes_limit: 5,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    billing_interval: null,
    ...overrides,
  } as unknown as Organization
}

function renderPage(o: Organization): string {
  state.org = o
  useAppStore.setState({ organization: o })
  return renderToString(createElement(BillingPage)).replaceAll('<!-- -->', '')
}

const heading = (html: string) => html.match(/<h2[^>]*id="billing-current-plan"[^>]*>([^<]*)<\/h2>/)?.[1]
const cards = (html: string) => [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1])

afterEach(() => {
  state.org = null
  useAppStore.setState({ organization: null })
})

describe('billing page', () => {
  it('names the trial "Free trial", as its card and onboarding do, with no second "Trial" chip', () => {
    const html = renderPage(org({}))
    expect(heading(html)).toBe('Free trial')
    expect(html).not.toMatch(/>Trial</)
    expect(html).toContain('No subscription · 5 minutes included')
  })

  it('switches "Monthly | Yearly", then says the yearly saving, as the homepage does', () => {
    const html = renderPage(org({}))
    expect(html).toMatch(/role="tab"[^>]*>Monthly</)
    expect(html).toMatch(/role="tab"[^>]*>Yearly</)
    expect(html).not.toMatch(/>Annual</)
    expect(html.indexOf('Two months free')).toBeGreaterThan(html.indexOf('>Yearly<'))
  })

  it('offers the trial its own card, as the current plan', () => {
    const html = renderPage(org({}))
    expect(cards(html)[0]).toBe('trial')
    expect(html).toMatch(/id="billing-month-trial"[^>]*data-state="current"/)
  })

  it('never shows a paying organization the trial card or a "Downgrade" to it', () => {
    const html = renderPage(org({ plan: 'growth', minutes_limit: 1000, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', billing_interval: 'month' }))
    expect(heading(html)).toBe('Growth')
    expect(html).toMatch(/>Active</)
    expect(cards(html)).not.toContain('trial')
    expect(cards(html)).toEqual(expect.arrayContaining(['starter', 'growth', 'pro', 'business', 'scale', 'custom']))
    expect(html).not.toContain('to Free trial')
    expect(html).not.toContain('$0 for 14 days')
    // Canceling stays in the Stripe portal.
    expect(html).toContain('Update your card, download invoices, or cancel')
  })

  it('prices a yearly subscriber\'s plan by the year and opens the picker on the yearly tab', () => {
    const html = renderPage(org({ plan: 'growth', minutes_limit: 1000, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', billing_interval: 'year' }))
    expect(html).toContain('$990 / year · 1,000 minutes included a month')
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Yearly<|aria-selected="true"[^>]*role="tab"[^>]*>Yearly</)
  })

  it('a store on a store plan sees the store cards, without the trial', () => {
    const html = renderPage(org({ plan: 'store_growth', business_type: 'ecommerce', minutes_limit: 950, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', billing_interval: 'month' }))
    expect(heading(html)).toBe('Store Growth')
    expect(cards(html).filter((c, i, all) => all.indexOf(c) === i)).toEqual(['store_starter', 'store_growth', 'store_scale', 'store_enterprise'])
  })
})
