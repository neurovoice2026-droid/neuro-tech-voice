import { describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

import { buildAgentSpec, loadCommerceSpec, type AgentRow } from './agent-spec'
import { buildElevenLabsAgentBody } from '@/lib/elevenlabs/agent-config'
import { SCRIPT_VARIABLES } from '@/lib/commerce/prompt'

// E-commerce vertical: the store flag and the script-variable placeholders
// follow the business type; only the store tools follow the connection state.
// A store whose connection is gone (disconnected, error, never connected) keeps
// a prompt that references {{call_reason}}, {{store_name}}, … — without their
// placeholders ElevenLabs refuses to start the call.

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

function agentRow(over: Partial<Record<keyof AgentRow, unknown>> = {}): AgentRow {
  return {
    id: AGENT, org_id: ORG, name: 'Maria', language: 'ro', system_prompt: null, first_message: null, fallback_message: null, voice_id: null,
    fallback_voice_id: null, is_active: true, metadata: {}, conversation_settings: {}, transfer_settings: {}, analysis_settings: {},
    privacy_settings: {}, voice_settings: {}, dynamic_variables: {}, after_hours: {}, working_hours: {}, config_revision: 4,
    primary_provider: 'elevenlabs', fallback_provider: 'cartesia', ...over,
  } as unknown as AgentRow
}

function db(connections: Array<Record<string, unknown>>, org: Record<string, unknown> = {}) {
  return memoryDb({
    organizations: [{ id: ORG, name: 'Acme SRL', timezone: 'Europe/Bucharest', plan: 'pro', business_type: 'ecommerce', commerce_profile: { display_name: 'Magazinul Exemplu' }, ...org }],
    phone_numbers: [],
    knowledge_documents: [],
    knowledge_crawls: [],
    commerce_connections: connections.map((c, i) => ({ id: `conn-${i}`, org_id: ORG, status: 'active', display_name: 'shop.example.com', created_at: `2026-01-0${i + 1}T00:00:00Z`, ...c })),
  })
}

const STORE_PROMPT = 'Magazinul {{store_name}}. Motivul apelului: {{call_reason}}. Comanda {{order_number}} pentru {{customer_name}}: {{items_summary}}, total {{order_total}}, livrare în {{delivery_city}}.'

describe('loadCommerceSpec', () => {
  it('a services organization is neither a store nor enabled', async () => {
    expect(await loadCommerceSpec(db([{ status: 'active' }], { business_type: 'services' }) as never, ORG)).toEqual({ enabled: false, isStore: false, storeName: null })
  })

  it('a store without any connection stays a store (name from the profile), tools off', async () => {
    expect(await loadCommerceSpec(db([]) as never, ORG)).toEqual({ enabled: false, isStore: true, storeName: 'Magazinul Exemplu' })
  })

  it('a store whose connections are disconnected or in error stays a store, tools off', async () => {
    expect(await loadCommerceSpec(db([{ status: 'disconnected' }, { status: 'error' }]) as never, ORG)).toEqual({ enabled: false, isStore: true, storeName: 'Magazinul Exemplu' })
  })

  it('a store with a usable connection is enabled', async () => {
    expect(await loadCommerceSpec(db([{ status: 'disconnected' }, { status: 'degraded' }]) as never, ORG)).toEqual({ enabled: true, isStore: true, storeName: 'Magazinul Exemplu' })
  })

  it('falls back to the connection display name, then to null, when the profile has no name', async () => {
    expect((await loadCommerceSpec(db([{ status: 'active' }], { commerce_profile: {} }) as never, ORG)).storeName).toBe('shop.example.com')
    expect((await loadCommerceSpec(db([], { commerce_profile: null }) as never, ORG)).storeName).toBeNull()
  })
})

describe('buildAgentSpec — store agent without a usable connection', () => {
  const PLATFORM = { transferToolId: null, postCallWebhookId: null }
  const placeholdersOf = (body: ReturnType<typeof buildElevenLabsAgentBody>) =>
    (body.conversation_config.agent as { dynamic_variables: { dynamic_variable_placeholders: Record<string, string> } }).dynamic_variables.dynamic_variable_placeholders

  it('keeps every script-variable placeholder after the store is disconnected (the prompt still references them)', async () => {
    const spec = await buildAgentSpec(db([{ status: 'disconnected' }]) as never, agentRow({ system_prompt: STORE_PROMPT }))
    expect(spec.commerce).toEqual({ enabled: false, isStore: true, storeName: 'Magazinul Exemplu' })
    expect(spec.systemPrompt).toContain('{{call_reason}}')
    // Degrades to "no store tools": the tool rules are not in the prompt.
    expect(spec.promptInput?.storeTools).toBe(false)
    expect(spec.systemPrompt).not.toContain('get_order_status')

    const vars = placeholdersOf(buildElevenLabsAgentBody(spec, PLATFORM))
    for (const name of SCRIPT_VARIABLES) expect(typeof vars[name], name).toBe('string')
    expect(vars).toMatchObject({ call_reason: 'inbound', store_name: 'Magazinul Exemplu', agent_name: 'Maria', order_number: '' })
  })

  it('a store that never connected gets the same placeholders, named after the org when the profile has no name', async () => {
    const spec = await buildAgentSpec(db([], { commerce_profile: null }) as never, agentRow({ system_prompt: STORE_PROMPT }))
    const vars = placeholdersOf(buildElevenLabsAgentBody(spec, PLATFORM))
    expect(vars.call_reason).toBe('inbound')
    expect(vars.store_name).toBe('Acme SRL')
  })

  it('a services organization never gets the script-variable placeholders', async () => {
    const spec = await buildAgentSpec(db([], { business_type: 'services' }) as never, agentRow())
    const vars = placeholdersOf(buildElevenLabsAgentBody(spec, PLATFORM))
    for (const name of SCRIPT_VARIABLES) expect(vars[name], name).toBeUndefined()
  })
})
