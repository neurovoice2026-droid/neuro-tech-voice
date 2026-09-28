import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Agent } from '@/types'

// The session loader's knowledge check isn't used here (facts come from the
// batched query); keep its dependencies out of this unit test.
vi.mock('@/lib/knowledge/search', () => ({ hasReadyKnowledge: async () => false }))

const { capabilitiesFor, loadSyncContexts } = await import('./context')
type CapabilityFacts = import('./context').CapabilityFacts
type SyncOrg = import('./context').SyncOrg

const ALL_FACTS: CapabilityFacts = {
  hasCalendarIntegration: true,
  hasSchedulingSettings: true,
  hasReadyKnowledge: true,
  hasSmsNumber: true,
  hasTransferContact: true,
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC00000000000000000000000000000000')
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('capabilitiesFor', () => {
  it('turns on every tool for a business plan with everything connected', () => {
    expect(capabilitiesFor({ lead_fields: [{ key: 'k', label: 'L', question: 'Q', required: false }] }, { plan: 'business', sms_enabled: true }, ALL_FACTS)).toEqual({
      calendar: true,
      knowledge: true,
      sms: true,
      transfer: true,
      take_message: true,
      waitlist: true,
      lead_fields: true,
    })
  })

  it('follows plan entitlements and integration keys', () => {
    expect(capabilitiesFor({ lead_fields: [] }, { plan: 'trial', sms_enabled: true }, ALL_FACTS)).toMatchObject({
      calendar: false,
      waitlist: false,
      sms: false,
      transfer: true,
    })
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    expect(capabilitiesFor({ lead_fields: [] }, { plan: 'business', sms_enabled: true }, ALL_FACTS)).toMatchObject({
      calendar: false,
      sms: false,
      transfer: false,
      take_message: true,
    })
  })

  it('needs booking settings for the calendar and respects the SMS switch', () => {
    const caps = capabilitiesFor({ lead_fields: [] }, { plan: 'business', sms_enabled: false }, { ...ALL_FACTS, hasSchedulingSettings: false })
    expect(caps).toMatchObject({ calendar: false, waitlist: false, sms: false })
  })
})

type Result = { data: unknown[] | null; error: { code?: string; message: string } | null }
/** A table's rows, or one result per page (read in order) to exercise pagination. */
type Rows = Record<string, Result | Result[]>

function fakeAdmin(rows: Rows) {
  const filters: { table: string; calls: [string, unknown[]][] }[] = []
  const pagesRead: Record<string, number> = {}
  const client = {
    from(table: string) {
      const entry = { table, calls: [] as [string, unknown[]][] }
      filters.push(entry)
      const chain: Record<string, unknown> = {}
      for (const method of ['select', 'in', 'eq', 'gt', 'order', 'limit', 'range']) {
        chain[method] = (...args: unknown[]) => {
          entry.calls.push([method, args])
          return chain
        }
      }
      chain.then = (resolve: (value: unknown) => unknown) => {
        const configured = rows[table]
        let result: Result = { data: [], error: null }
        if (Array.isArray(configured)) {
          const index = pagesRead[table] ?? 0
          pagesRead[table] = index + 1
          result = configured[index] ?? { data: [], error: null }
        } else if (configured) {
          result = configured
        }
        return Promise.resolve(result).then(resolve)
      }
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, filters }
}

function agent(id: string, orgId: string): Agent {
  return { id, org_id: orgId, lead_fields: [] } as unknown as Agent
}

const ORG_A: SyncOrg = { id: 'org-a', name: 'A', timezone: 'UTC', plan: 'business', sms_enabled: true, onboarding_completed: true }
const ORG_B: SyncOrg = { id: 'org-b', name: 'B', timezone: 'UTC', plan: 'business', sms_enabled: true, onboarding_completed: true }

describe('loadSyncContexts', () => {
  it('derives each agent’s tools, services and team from batched, org-scoped queries', async () => {
    const { client, filters } = fakeAdmin({
      integrations: { data: [{ org_id: 'org-a' }], error: null },
      knowledge_documents: { data: [{ agent_id: 'agent-b' }], error: null },
      phone_numbers: { data: [], error: null },
      escalation_contacts: {
        data: [{ org_id: 'org-a', name: 'Ana', role: 'Manager', phone: '+40712345678', transfer_enabled: true, is_on_call: true, conditions: 'Complaints', sort_order: 0 }],
        error: null,
      },
      scheduling_settings: { data: [{ org_id: 'org-a', services: [{ name: 'Cleaning', duration_minutes: 30 }] }], error: null },
    })

    const contexts = await loadSyncContexts(client, [
      { agent: agent('agent-a', 'org-a'), org: ORG_A },
      { agent: agent('agent-b', 'org-b'), org: ORG_B },
    ])

    const a = contexts.get('agent-a')
    const b = contexts.get('agent-b')
    expect(a?.capabilities).toMatchObject({ calendar: true, knowledge: false, transfer: true, sms: false })
    expect(a?.services).toEqual([{ name: 'Cleaning', duration_minutes: 30 }])
    expect(a?.contactsSummary).toContain('Ana (Manager)')
    expect(a?.contactsSummary).not.toContain('+40')
    expect(b?.capabilities).toMatchObject({ calendar: false, knowledge: true, transfer: false })
    expect(b?.contactsSummary).toBeNull()

    for (const query of filters) {
      const scoped = query.calls.some(([method, args]) => method === 'in' && (args[0] === 'org_id' || args[0] === 'agent_id'))
      expect(scoped, query.table).toBe(true)
    }
  })

  it('reads past the 1,000-row response cap so no agent’s knowledge is missed', async () => {
    const fullPage = Array.from({ length: 1000 }, () => ({ agent_id: 'agent-a' }))
    const { client, filters } = fakeAdmin({
      knowledge_documents: [
        { data: fullPage, error: null },
        { data: [{ agent_id: 'agent-b' }], error: null },
      ],
    })
    const contexts = await loadSyncContexts(client, [
      { agent: agent('agent-a', 'org-a'), org: ORG_A },
      { agent: agent('agent-b', 'org-b'), org: ORG_B },
    ])
    expect(contexts.get('agent-b')?.capabilities.knowledge).toBe(true)
    const ranges = filters
      .filter((query) => query.table === 'knowledge_documents')
      .map((query) => query.calls.find(([method]) => method === 'range')?.[1])
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    // Pages need a stable order.
    for (const query of filters) expect(query.calls.some(([method]) => method === 'order'), query.table).toBe(true)
  })

  it('treats tables from an unapplied migration as empty but surfaces other failures', async () => {
    const missing = fakeAdmin({ escalation_contacts: { data: null, error: { code: '42P01', message: 'relation does not exist' } } })
    const contexts = await loadSyncContexts(missing.client, [{ agent: agent('agent-a', 'org-a'), org: ORG_A }])
    expect(contexts.get('agent-a')?.contactsSummary).toBeNull()

    const broken = fakeAdmin({ phone_numbers: { data: null, error: { code: '57014', message: 'statement timeout' } } })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(loadSyncContexts(broken.client, [{ agent: agent('agent-a', 'org-a'), org: ORG_A }])).rejects.toThrow('sms number lookup failed')
    error.mockRestore()
  })
})
