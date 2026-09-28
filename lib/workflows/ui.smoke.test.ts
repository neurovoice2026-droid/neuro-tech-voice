import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { WorkflowSummary } from './types'

// Server-renders the dashboard screens with realistic props so a missing label,
// a bad lookup or a crash in a card shows up in CI rather than in a browser.

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }))

const { WorkflowsClient } = await import('@/components/workflows/WorkflowsClient')
const { IntegrationsClient } = await import('@/components/integrations/IntegrationsClient')
const { IntegrationsStatus } = await import('@/components/dashboard/IntegrationsStatus')

const connections = {
  google_calendar: { connected: true, account_email: 'owner@example.com' },
  gmail: { connected: false, account_email: null },
  google_sheets: { connected: false, account_email: null },
  google_docs: { connected: false, account_email: null },
  google_drive: { connected: false, account_email: null },
}

const capabilities = {
  google: { allowed: true, requiredPlan: 'pro' as const, available: true },
  sms: { allowed: true, requiredPlan: 'starter' as const },
  connections,
}

const workflows: WorkflowSummary[] = [
  {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'Emergencies to on-call',
    description: null,
    trigger: 'keyword_detected',
    trigger_config: { keyword: 'emergency, urgență' },
    actions: [
      { id: 'w1', type: 'send_webhook', config: { url: 'https://hooks.example.com/in' } },
      { id: 's1', type: 'notify_slack', config: { webhook_url: 'https://hooks.slack.com/services/T/B/x' } },
      { id: 'g1', type: 'add_to_sheet', config: { spreadsheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' } },
    ],
    enabled: true,
    runs: 12,
    successful_runs: 11,
    last_run_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    created_at: '2026-09-01T10:00:00Z',
    updated_at: null,
  },
  {
    id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'Legacy step',
    description: 'Saved by the old builder',
    trigger: 'call_missed',
    trigger_config: {},
    actions: [{ id: 'a0', type: 'send_webhook', config: { url: 'http://insecure.example.com' } }],
    enabled: false,
    runs: 0,
    successful_runs: 0,
    last_run_at: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: null,
  },
]

describe('dashboard screens render', () => {
  it('workflows list with cards, keyword, beta badge and attention flag', () => {
    const html = renderToStaticMarkup(createElement(WorkflowsClient, { initialWorkflows: workflows, capabilities }))
    expect(html).toContain('Emergencies to on-call')
    expect(html).toContain('emergency, urgență')
    expect(html).toContain('Add row (Google Sheets)')
    expect(html).toContain('Beta')
    expect(html).toContain('92% success')
    expect(html).toContain('Needs attention')
    expect(html).toContain('No code needed')
    // Workflows with a webhook or Slack step offer a visible test button, not only the menu item.
    expect(html.match(/<button[^>]*>(?:(?!<\/button>).)*Send test<\/button>/g)?.length).toBe(2)
  })

  it('workflows empty and error states', () => {
    expect(renderToStaticMarkup(createElement(WorkflowsClient, { initialWorkflows: [], capabilities }))).toContain('No workflows yet')
    expect(renderToStaticMarkup(createElement(WorkflowsClient, { initialWorkflows: null, capabilities }))).toContain('We couldn’t load your workflows')
  })

  it('integrations page: connected account, upgrade notice and truthful webhook card', () => {
    const html = renderToStaticMarkup(
      createElement(IntegrationsClient, {
        connections: Object.fromEntries(
          Object.entries(connections).map(([type, c]) => [type, { ...c, needs_reconnect: type === 'gmail', connected_at: null }])
        ) as never,
        legacyWebhookSaved: true,
        google: { allowed: false, requiredPlan: 'pro', available: true },
        loaded: true,
      })
    )
    expect(html).toContain('Connected as <span class="font-medium">owner@example.com</span>')
    expect(html).toContain('Google Workspace is available on Pro and above')
    expect(html).toContain('Signed with HMAC-SHA256')
    expect(html).toContain('Retried up to 3 attempts')
    expect(html).toContain('Needs reconnecting')
    expect(html).toContain('never used to send anything')
    expect(html).not.toMatch(/user limit|Work in progress/i)
  })

  it('dashboard integrations card', () => {
    const html = renderToStaticMarkup(createElement(IntegrationsStatus, { integrations: [{ type: 'gmail', is_active: true }] }))
    expect(html).toContain('Google Drive')
    expect(html).toContain('Slack and webhooks')
  })
})
