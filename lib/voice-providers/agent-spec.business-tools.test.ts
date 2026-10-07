import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

import { buildAgentSpec, type AgentRow } from './agent-spec'

// In-call business tools in the spec (slice B2): booking needs the setting
// and the org's own Google Calendar connection; the fallback agent never
// books but can take messages.

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

function agentRow(): AgentRow {
  return {
    id: AGENT, org_id: ORG, name: 'A', language: 'en', system_prompt: null, first_message: null, fallback_message: null, voice_id: 'v1',
    fallback_voice_id: null, is_active: true, metadata: {}, conversation_settings: {}, transfer_settings: {}, analysis_settings: {},
    privacy_settings: {}, voice_settings: {}, dynamic_variables: {}, after_hours: {}, working_hours: {}, config_revision: 4,
    primary_provider: 'elevenlabs', fallback_provider: 'cartesia',
  } as unknown as AgentRow
}

function db(settings: { booking?: unknown; messages?: unknown; calendarOrg?: string | null }) {
  return memoryDb({
    organizations: [{ id: ORG, name: 'Acme', timezone: 'Europe/Bucharest', plan: 'pro' }],
    agents: [{ id: AGENT, org_id: ORG, booking_settings: settings.booking ?? {}, message_settings: settings.messages ?? {} }],
    integrations: settings.calendarOrg ? [{ org_id: settings.calendarOrg, type: 'google_calendar', is_active: true, google_refresh_token: 'rt' }] : [],
    phone_numbers: [],
    knowledge_documents: [],
    knowledge_crawls: [],
  })
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret')
  vi.stubEnv('CARTESIA_TOOL_SECRET', 'cartesia-tool-secret-0123456789abcdef')
})
afterEach(() => vi.unstubAllEnvs())

describe('buildAgentSpec — business tools', () => {
  it('nothing enabled: no tools, prompts unchanged', async () => {
    const spec = await buildAgentSpec(db({}) as never, agentRow())
    expect(spec.businessTools).toEqual({ bookingEnabled: false, booking: false, takeMessage: false })
    expect(spec.systemPrompt).not.toContain('take_message')
    expect(spec.systemPrompt).not.toContain('check_availability')
  })

  it('booking + calendar connected: booking tools in the ElevenLabs prompt; the fallback takes a message with take_message', async () => {
    const spec = await buildAgentSpec(db({ booking: { enabled: true }, messages: { enabled: true }, calendarOrg: ORG }) as never, agentRow())
    expect(spec.businessTools).toEqual({ bookingEnabled: true, booking: true, takeMessage: true })
    expect(spec.promptInput).toMatchObject({ bookingMode: 'tools', takeMessageTool: true })
    expect(spec.systemPrompt).toContain('call book_appointment')
    expect(spec.fallbackSystemPrompt).toContain('you cannot see the calendar or book appointments')
    expect(spec.fallbackSystemPrompt).toContain('Then call take_message once')
    expect(spec.fallbackSystemPrompt).not.toContain('book_appointment')
  })

  it("booking without the org's own calendar connection: never promises a time", async () => {
    const spec = await buildAgentSpec(db({ booking: { enabled: true }, calendarOrg: 'another-org' }) as never, agentRow())
    expect(spec.businessTools).toEqual({ bookingEnabled: true, booking: false, takeMessage: false })
    expect(spec.promptInput?.bookingMode).toBe('take_message')
    expect(spec.systemPrompt).toContain('you cannot see the calendar or book appointments')
  })
})
