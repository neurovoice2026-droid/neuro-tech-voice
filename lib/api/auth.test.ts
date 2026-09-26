import { beforeEach, describe, expect, it, vi } from 'vitest'

// Scriptable Supabase stand-in: records the query chain and answers with the
// next queued result for that table.
interface QueryResult {
  data: unknown
  error: { code?: string; message: string } | null
}

const state = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  results: {} as Record<string, QueryResult[]>,
  queries: [] as { table: string; calls: [string, unknown[]][] }[],
  createClientCalls: 0,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    state.createClientCalls++
    return {
      auth: {
        getUser: async () =>
          state.user ? { data: { user: state.user }, error: null } : { data: { user: null }, error: { message: 'Auth session missing!' } },
      },
      from(table: string) {
        const query = { table, calls: [] as [string, unknown[]][] }
        state.queries.push(query)
        const builder: Record<string, unknown> = {}
        for (const method of ['select', 'eq', 'order', 'limit']) {
          builder[method] = (...args: unknown[]) => {
            query.calls.push([method, args])
            return builder
          }
        }
        builder.maybeSingle = async () => {
          query.calls.push(['maybeSingle', []])
          return state.results[table]?.shift() ?? { data: null, error: null }
        }
        return builder
      },
    }
  },
}))

import {
  getOrgAgent,
  getOrgContext,
  getSessionUser,
  ORGANIZATION_COLUMNS,
  requireOrgAgent,
  requireOrgContext,
  withAgentDefaults,
  withOrganizationDefaults,
} from './auth'
import type { Organization } from '@/types'

const ORG: Organization = {
  id: 'org-1',
  user_id: 'user-1',
  name: 'Acme Dental',
  industry: 'dental',
  website: null,
  description: null,
  logo_url: null,
  onboarding_completed: true,
  onboarding_step: 5,
  plan: 'pro',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  minutes_used: 10,
  minutes_limit: 850,
  timezone: 'Europe/Bucharest',
  trial_ends_at: null,
  billing_interval: 'month',
  usage_period_start: null,
  usage_period_end: null,
  sms_enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  state.user = null
  state.results = {}
  state.queries = []
  state.createClientCalls = 0
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('ORGANIZATION_COLUMNS', () => {
  it('lists every Organization field explicitly', () => {
    expect(ORGANIZATION_COLUMNS.split(', ').sort()).toEqual(Object.keys(ORG).sort())
  })
})

describe('requireOrgContext', () => {
  it('throws 401 when signed out', async () => {
    await expect(requireOrgContext()).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    await expect(getOrgContext()).resolves.toBeNull()
    await expect(getSessionUser()).resolves.toBeNull()
  })

  it('throws 404 when the user has no organization', async () => {
    state.user = { id: 'user-1', email: 'a@b.co' }
    await expect(requireOrgContext()).rejects.toMatchObject({ status: 404, code: 'org_not_found' })
  })

  it('loads the organization with explicit columns scoped to the user', async () => {
    state.user = { id: 'user-1', email: 'owner@acme.test' }
    state.results.organizations = [{ data: ORG, error: null }]
    const ctx = await requireOrgContext()
    expect(ctx.user).toEqual({ id: 'user-1', email: 'owner@acme.test' })
    expect(ctx.org).toEqual(ORG)
    const orgQuery = state.queries.find((q) => q.table === 'organizations')
    expect(orgQuery?.calls).toEqual([
      ['select', [ORGANIZATION_COLUMNS]],
      ['eq', ['user_id', 'user-1']],
      ['maybeSingle', []],
    ])
  })

  it('maps a missing email to null', async () => {
    state.user = { id: 'user-1' }
    state.results.organizations = [{ data: ORG, error: null }]
    await expect(getSessionUser()).resolves.toMatchObject({ user: { id: 'user-1', email: null } })
  })

  it('falls back to legacy columns before migration 010', async () => {
    state.user = { id: 'user-1', email: null as unknown as string }
    const legacy: Record<string, unknown> = { ...ORG, plan: 'trial' }
    for (const key of ['timezone', 'trial_ends_at', 'billing_interval', 'usage_period_start', 'usage_period_end', 'sms_enabled']) {
      delete legacy[key]
    }
    state.results.organizations = [
      { data: null, error: { code: '42703', message: 'column organizations.timezone does not exist' } },
      { data: legacy, error: null },
    ]
    const ctx = await requireOrgContext()
    expect(ctx.org).toMatchObject({
      timezone: 'UTC',
      sms_enabled: true,
      billing_interval: null,
      trial_ends_at: '2026-01-15T00:00:00.000Z',
    })
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('throws (500 via handleRoute) on other database errors instead of pretending there is no org', async () => {
    state.user = { id: 'user-1' }
    state.results.organizations = [{ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }]
    await expect(requireOrgContext()).rejects.toThrow('Organization lookup failed')
  })
})

describe('getOrgAgent', () => {
  async function ctx() {
    state.user = { id: 'user-1' }
    state.results.organizations = [{ data: ORG, error: null }]
    return requireOrgContext()
  }

  it('selects the newest agent of the org', async () => {
    const context = await ctx()
    state.results.agents = [{ data: { id: 'agent-1', org_id: 'org-1', name: 'Ana', tone: 'friendly', metadata: {} }, error: null }]
    const agent = await getOrgAgent(context)
    expect(agent).toMatchObject({ id: 'agent-1', tone: 'friendly', keyterms: [], provider_sync: {} })
    const agentQuery = state.queries.find((q) => q.table === 'agents')
    expect(agentQuery?.calls).toEqual([
      ['select', ['*']],
      ['eq', ['org_id', 'org-1']],
      ['order', ['created_at', { ascending: false }]],
      ['limit', [1]],
      ['maybeSingle', []],
    ])
  })

  it('returns null without an agent and requireOrgAgent throws 404', async () => {
    const context = await ctx()
    await expect(getOrgAgent(context)).resolves.toBeNull()
    await expect(requireOrgAgent(context)).rejects.toMatchObject({ status: 404, code: 'agent_not_found' })
  })

  it('throws on database errors', async () => {
    const context = await ctx()
    state.results.agents = [{ data: null, error: { code: '500', message: 'boom' } }]
    await expect(getOrgAgent(context)).rejects.toThrow('Agent lookup failed')
  })
})

describe('row defaults', () => {
  it('fills agent fields added by migration 010 and maps legacy personality', () => {
    const agent = withAgentDefaults({ id: 'a', org_id: 'o', name: 'Ana', metadata: { personality: 'empathetic' } })
    expect(agent).toMatchObject({
      cartesia_agent_id: null,
      cartesia_voice_id: null,
      tone: 'empathetic',
      voice_speed: null,
      keyterms: [],
      lead_fields: [],
      recording_notice: false,
      pipeline_mode_override: null,
      provider_sync: {},
    })
    expect(withAgentDefaults({ id: 'a', metadata: { personality: 'educational' } }).tone).toBe('professional')
    // The old dashboard stored capitalised labels; migration 010 lowercases them the same way.
    expect(withAgentDefaults({ id: 'a', metadata: { personality: ' Friendly ' } }).tone).toBe('friendly')
    expect(withAgentDefaults({ id: 'a', tone: 'casual', metadata: null }).metadata).toEqual({})
  })

  it('keeps values present on an organization row', () => {
    expect(withOrganizationDefaults({ ...ORG })).toEqual(ORG)
  })
})
