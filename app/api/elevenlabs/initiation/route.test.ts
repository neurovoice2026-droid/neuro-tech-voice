// POST /api/elevenlabs/initiation: workspace-secret header (constant-time,
// fails closed), validated body (JSON or form), placeholders never errors
// once authenticated. The resolution itself is tested in
// lib/telephony/initiation.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'

const handleInitiation = vi.fn()
vi.mock('@/lib/telephony/initiation', () => ({ handleInitiation: (...a: unknown[]) => handleInitiation(...a) }))

import { POST } from './route'

const KEY = 'k'.repeat(48)
const BODY = { agent_id: 'agent_8401k', caller_id: '+40712345678', called_number: '+40312345678', call_sid: 'CA0123456789abcdef0123456789abcdef', conversation_id: 'conv_01abc' }
const ANSWER = { type: 'conversation_initiation_client_data', dynamic_variables: { ntv_call_id: 'x' } }

function post(body: unknown, headers: Record<string, string> = { 'X-NTV-Tool-Key': KEY }, contentType = 'application/json'): Request {
  return new Request('https://voice.example.com/api/elevenlabs/initiation', {
    method: 'POST',
    headers: { 'content-type': contentType, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

let events: ProviderEvent[] = []
let restoreSink: () => void = () => {}
afterEach(() => restoreSink())
beforeEach(() => {
  vi.stubEnv('ELEVENLABS_TOOL_SECRET', KEY)
  vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', '')
  handleInitiation.mockReset().mockResolvedValue({ body: ANSWER, outcome: 'created' })
  events = []
  restoreSink = setProviderEventSink((e) => events.push(e))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('authentication', () => {
  it('answers the client data for an authentic request', async () => {
    const res = await POST(post(BODY))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual(ANSWER)
    expect(handleInitiation.mock.calls[0][0]).toEqual(BODY)
  })

  it('refuses a missing or wrong key without reading the body', async () => {
    for (const headers of [{}, { 'X-NTV-Tool-Key': 'wrong' }, { 'X-NTV-Tool-Key': `${KEY}x` }] as Array<Record<string, string>>) {
      const res = await POST(post(BODY, headers))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    expect(handleInitiation).not.toHaveBeenCalled()
    expect(events.some((e) => e.kind === 'webhook_verification_failed')).toBe(true)
  })

  it('fails closed when no key is configured (any environment)', async () => {
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', '')
    const res = await POST(post(BODY, {}))
    expect(res.status).toBe(401)
    expect(handleInitiation).not.toHaveBeenCalled()
  })

  it('accepts the previous key during a rotation', async () => {
    const previous = 'p'.repeat(40)
    vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', previous)
    expect((await POST(post(BODY, { 'X-NTV-Tool-Key': previous }))).status).toBe(200)
  })
})

describe('body validation', () => {
  it('accepts a form-encoded body too', async () => {
    const res = await POST(post(new URLSearchParams(BODY).toString(), { 'X-NTV-Tool-Key': KEY }, 'application/x-www-form-urlencoded'))
    expect(res.status).toBe(200)
    expect(handleInitiation.mock.calls[0][0]).toMatchObject({ agent_id: BODY.agent_id, call_sid: BODY.call_sid })
  })

  it('rejects malformed ids, a missing agent id, invalid JSON and oversized bodies', async () => {
    expect((await POST(post({ ...BODY, agent_id: '../agents' }))).status).toBe(400)
    expect((await POST(post({ ...BODY, call_sid: 'CA x; drop' }))).status).toBe(400)
    expect((await POST(post({ caller_id: '+40712345678' }))).status).toBe(400)
    expect((await POST(post('{not json'))).status).toBe(400)
    expect((await POST(post({ ...BODY, caller_id: 'x'.repeat(20_000) }))).status).toBe(413)
    expect(handleInitiation).not.toHaveBeenCalled()
  })

  it('accepts null optional fields (anonymous caller)', async () => {
    const res = await POST(post({ ...BODY, caller_id: null, call_sid: null }))
    expect(res.status).toBe(200)
  })
})
