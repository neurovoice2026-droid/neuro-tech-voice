// The store routes a merchant meets before launch: the onboarding's
// automations step can turn an automation on although the agent is activated
// only at launch and a number is bought only after it, and the connect cards
// learn up front which platforms this deployment cannot connect (Shopify
// without its app) instead of failing after a redirect.
import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({ supabase: null, user: { id: '66666666-6666-4666-8666-666666666666', email: null }, org: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Magazinul Exemplu', timezone: 'Europe/Bucharest', plan: 'trial' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { AGENT_A, CONN_A, ORG_A, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { PUT as putAutomation } from '@/app/api/commerce/automations/[type]/route'
import { GET as listConnections } from '@/app/api/commerce/connections/route'
import { GET as onboardingState } from '@/app/api/commerce/onboarding/state/route'

function seed(org: Record<string, unknown>) {
  state.db = commerceDb({
    organizations: [orgRow(ORG_A, org)],
    agents: [{ id: AGENT_A, org_id: ORG_A, name: 'Maria', is_active: false, created_at: 'x' }],
    phone_numbers: [],
    commerce_connections: [connectionRow()],
    commerce_automations: [],
    commerce_automation_runs: [],
  })
  return state.db as ReturnType<typeof commerceDb>
}

const request = (method: string, body?: unknown) =>
  new Request('https://app.example.com/x', { method, headers: { 'content-type': 'application/json', origin: 'https://app.example.com', host: 'app.example.com' }, body: body === undefined ? undefined : JSON.stringify(body) })

beforeEach(() => {
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', crypto.randomBytes(32).toString('base64'))
  vi.stubEnv('SHOPIFY_CLIENT_ID', '')
  vi.stubEnv('SHOPIFY_CLIENT_SECRET', '')
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://app.example.com')
})

describe('PUT /api/commerce/automations/[type] before launch', () => {
  it('turns the automation on during the store onboarding (agent not live yet, no number)', async () => {
    const db = seed({ onboarding_completed: false, onboarding_step: 4 })
    const res = await putAutomation(request('PUT', { connection_id: CONN_A, enabled: true, consent_confirmed: true }), { params: Promise.resolve({ type: 'cod_confirmation' }) })
    expect(res.status).toBe(200)
    expect((await res.json()).automation).toMatchObject({ type: 'cod_confirmation', enabled: true })
    expect(db.tables.commerce_automations[0]).toMatchObject({ enabled: true })
  })

  it('answers 409 agent_inactive for the same request after launch', async () => {
    seed({ onboarding_completed: true })
    const res = await putAutomation(request('PUT', { connection_id: CONN_A, enabled: true, consent_confirmed: true }), { params: Promise.resolve({ type: 'cod_confirmation' }) })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ details: { reason: 'agent_inactive' } })
  })
})

describe('what this deployment can connect', () => {
  it('reports Shopify as not configured (booleans only) on the connections list and the onboarding state', async () => {
    seed({ onboarding_completed: false })
    const list = await (await listConnections(request('GET'))).json()
    expect(list.config).toEqual({ encryption: true, shopify: false, publicBaseUrl: true })
    // The WooCommerce connection carries the address its cart events go to.
    expect(list.items[0]).toMatchObject({ id: CONN_A, webhook_url: `https://app.example.com/api/commerce/webhooks/woocommerce/${connectionRow().webhook_public_id}` })
    const onboarding = await (await onboardingState(request('GET'))).json()
    expect(onboarding.config).toMatchObject({ shopify: false })
  })

  it('reports Shopify once the app is configured, without echoing its credentials', async () => {
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client-id-for-tests')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'client-secret-for-tests')
    seed({ onboarding_completed: true })
    const res = await listConnections(request('GET'))
    const text = await res.text()
    expect(JSON.parse(text).config.shopify).toBe(true)
    expect(text).not.toContain('client-secret-for-tests')
    expect(text).not.toContain('client-id-for-tests')
  })
})
