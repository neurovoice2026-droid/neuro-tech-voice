// Dashboard chrome and cards, rendered as the server does:
// - the plan reads as its PLANS display name ("Store Growth", "Enterprise",
//   "Free trial") in the sidebar minutes tile, the account menu badge and
//   Settings, never as its id (components/dashboard/plan-label.ts);
// - the store org's longer sidebar uses tighter desktop rows, and the nav has
//   scroll cues for the links out of view (components/dashboard/DashboardShell.tsx);
// - the answered rate and the average duration show "—" while nothing has
//   finished or completed (components/dashboard/MetricsCards.tsx);
// - message callback numbers use the calls lists' readable form
//   (components/dashboard/OpenMessagesList.tsx).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/actions', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { OpenMessagesList } from '@/components/dashboard/OpenMessagesList'
import { planBadgeText, planDisplayName } from '@/components/dashboard/plan-label'
import { currentPlanName } from '@/components/pricing/plan-change'
import { SettingsPageClient } from '@/components/settings/SettingsPageClient'
import type { CallMessageView } from '@/lib/voice-tools/message-view'
import { PLANS, type DashboardMetrics, type Organization, type Plan } from '@/types'

const render = (element: Parameters<typeof renderToString>[0]) => renderToString(element).replaceAll('<!-- -->', '')

const ORG: Organization = {
  id: 'org1',
  user_id: 'u1',
  name: 'Casa Lumina',
  business_type: 'ecommerce',
  industry: null,
  website: null,
  description: null,
  logo_url: null,
  onboarding_completed: true,
  onboarding_step: 6,
  plan: 'store_growth',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  minutes_used: 386,
  minutes_limit: 950,
  extra_minutes_balance: 420,
} as Organization

function shell(org: Organization): string {
  // Children go in createElement's third argument; the cast covers the props' required `children`.
  const props = { org, agent: null, userEmail: 'owner@example.test', hasPhoneNumber: true } as Parameters<typeof DashboardShell>[0]
  return render(createElement(DashboardShell, props, createElement('p', null, 'page')))
}

describe('plan names', () => {
  it('uses the PLANS display name, "Free trial" for the trial and for an id the client does not know', () => {
    expect(planDisplayName('store_growth')).toBe('Store Growth')
    expect(planDisplayName('custom')).toBe('Enterprise')
    expect(planDisplayName('pro')).toBe('Pro')
    expect(planDisplayName('trial')).toBe('Free trial')
    expect(planDisplayName('platinum')).toBe('Free trial')
    expect(planDisplayName(null)).toBe('Free trial')
  })

  it('names every plan as the billing page does', () => {
    for (const plan of Object.keys(PLANS) as Plan[]) expect(planDisplayName(plan)).toBe(currentPlanName(plan))
  })

  it('stays light: the shell loads it on every page, so it never imports the pricing modules', () => {
    const source = readFileSync(fileURLToPath(new URL('../components/dashboard/plan-label.ts', import.meta.url)), 'utf8')
    expect([...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['@/types'])
  })

  it('the account menu badge says "plan" after a paid plan, not after the trial', () => {
    expect(planBadgeText('store_growth')).toBe('Store Growth plan')
    expect(planBadgeText('custom')).toBe('Enterprise plan')
    expect(planBadgeText('trial')).toBe('Free trial')
    expect(planBadgeText(undefined)).toBe('Free trial')
  })

  it('the sidebar minutes tile names the plan, not its id', () => {
    const html = shell(ORG)
    expect(html).toContain('title="Store Growth">Store Growth</span>')
    expect(html).toContain('386 / 950 min')
    expect(html).not.toMatch(/store_growth/i)
    expect(html).not.toContain('capitalize')
  })

  it('Settings shows the display name in the plan chip', () => {
    const html = render(createElement(SettingsPageClient, { businessName: 'Casa Lumina', email: 'o@example.test', plan: 'store_growth', deletionRequested: false }))
    expect(html).toContain('Store Growth')
    expect(html).not.toMatch(/store_growth|capitalize/)
    const trial = render(createElement(SettingsPageClient, { businessName: null, email: null, plan: null, deletionRequested: false }))
    expect(trial).toContain('Free trial')
  })
})

describe('sidebar nav', () => {
  it('store org: tighter rows on the desktop sidebar (the phone sheet keeps 36 px rows)', () => {
    const html = shell(ORG)
    const links = html.match(/<a [^>]*class="flex h-9[^"]*"/g) ?? []
    expect(links).toHaveLength(16)
    for (const link of links) expect(link).toContain('lg:h-8')
    expect(html.match(/lg:pt-3\.5/g)).toHaveLength(3)
  })

  it('service org: rows as before', () => {
    const html = shell({ ...ORG, business_type: 'services', plan: 'pro' })
    expect(html.match(/<a [^>]*class="flex h-9[^"]*"/g)).toHaveLength(8)
    expect(html).not.toContain('lg:h-8')
    expect(html).not.toContain('lg:pt-3.5')
  })

  it('the nav scrolls under fades that the browser turns on where links are out of view', () => {
    const html = shell(ORG)
    expect(html).toMatch(/<nav aria-label="Main" class="min-h-0 flex-1 overflow-y-auto/)
    // Hidden in the server HTML: the browser measures the list before showing either.
    expect(html).toMatch(/data-scroll-cue="above" class="[^"]*opacity-0/)
    expect(html).toMatch(/data-scroll-cue="below" class="[^"]*opacity-0/)
    // The usage tile stays outside the scroll box, below it.
    expect(html.indexOf('386 / 950 min')).toBeGreaterThan(html.indexOf('data-scroll-cue="below"'))
    // Settings and Billing are in the list (and in the account menu).
    expect(html).toContain('href="/settings"')
    expect(html).toContain('href="/billing"')
  })
})

const METRICS: DashboardMetrics = {
  total_calls: 0,
  total_duration_seconds: 0,
  avg_duration_seconds: 0,
  calls_today: 0,
  calls_this_week: 0,
  calls_this_month: 0,
  sentiment_breakdown: { positive: 0, neutral: 0, negative: 0 },
  peak_hour: 0,
  success_rate: 0,
  finished_calls: 0,
  completed_calls: 0,
  minutes_used: 0,
  minutes_limit: 30,
}

describe('metric tiles', () => {
  it('no calls: "—" for the answered rate and the average duration, not 0% and 0s', () => {
    const html = render(createElement(MetricsCards, { metrics: METRICS }))
    expect(html).toContain('No finished calls yet')
    expect(html).toContain('No completed calls yet')
    expect(html).not.toContain('>0%<')
    expect(html).not.toContain('>0s<')
    expect(html.match(/—/g)).toHaveLength(2)
  })

  it('finished calls but none completed: a 0% answered rate is real, the average is not', () => {
    const html = render(createElement(MetricsCards, { metrics: { ...METRICS, total_calls: 3, finished_calls: 3, completed_calls: 0 } }))
    expect(html).toContain('of finished calls')
    expect(html).toContain('>0%<')
    expect(html).toContain('No completed calls yet')
    expect(html).not.toContain('No finished calls yet')
  })

  it('calls in hand: the usual hints', () => {
    const html = render(createElement(MetricsCards, { metrics: { ...METRICS, total_calls: 5, finished_calls: 4, completed_calls: 3, success_rate: 75, avg_duration_seconds: 80 } }))
    expect(html).toContain('of finished calls')
    expect(html).toContain('completed calls')
    expect(html).not.toContain('yet')
  })

  it('an API without the denominators falls back on total_calls', () => {
    const { finished_calls: _f, completed_calls: _c, ...older } = METRICS
    expect(render(createElement(MetricsCards, { metrics: older }))).toContain('No finished calls yet')
    expect(render(createElement(MetricsCards, { metrics: { ...older, total_calls: 2 } }))).not.toContain('yet')
  })

  it('a failed request still shows "—" with the usual hints', () => {
    const html = render(createElement(MetricsCards, { metrics: null }))
    expect(html).toContain('of finished calls')
    expect(html).not.toContain('yet')
  })
})

describe('messages to follow up', () => {
  const message = (callback_number: string | null): CallMessageView => ({
    id: 'm1',
    call_id: null,
    caller_name: 'Priya Shah',
    callback_number,
    reason: 'Needs a receipt',
    urgency: 'normal',
    status: 'open',
    done_at: null,
    notified_at: null,
    notify_error: null,
    purged: false,
    created_at: '2026-10-15T08:00:00Z',
  } as CallMessageView)

  it('prints the callback number like the calls lists, and dials the raw number', () => {
    const us = render(createElement(OpenMessagesList, { messages: [message('+19175550126')], busyId: null, onDone: vi.fn() }))
    expect(us).toContain('+1 (917) 555-0126')
    expect(us).toContain('href="tel:+19175550126"')
    const ro = render(createElement(OpenMessagesList, { messages: [message('+40723000027')], busyId: null, onDone: vi.fn() }))
    expect(ro).toContain('+40 723 000 027')
  })

  it('leaves a number the caller gave in national form as given', () => {
    const html = render(createElement(OpenMessagesList, { messages: [message('0723 000 027')], busyId: null, onDone: vi.fn() }))
    expect(html).toContain('0723 000 027')
  })
})
