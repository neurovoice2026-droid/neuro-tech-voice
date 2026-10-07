// Slice C wrappers: the v2 phone-number listing (always narrowed), the
// phone-number calls in client.ts and the native outbound call (no retry, no
// routing-circuit feed, ringing timeout). Every call is a mocked fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as phones from './phone-numbers'
import * as el from '../client'
import { initiationWebhookBlock, OUTBOUND_RING_TIMEOUT_S } from './telephony'
import { peek, setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, timeoutError, type FetchMock } from '@/tests/helpers/fetch'

let fetchMock: FetchMock
let restoreSink: () => void

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'sk_0123456789abcdef0123456789abcdef0123')
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

const page = (numbers: Array<Record<string, unknown>>, next: string | null = null) =>
  jsonResponse({ phone_numbers: numbers, next_cursor: next, has_more: !!next })

describe('GET /v1/convai/v2/phone-numbers', () => {
  it('listImportedNumbersPage sends only the spec filters, page_size capped at 100', async () => {
    fetchMock.mockResolvedValueOnce(page([]))
    await phones.listImportedNumbersPage({ phone_number: '+40312345678', provider: 'twilio', page_size: 5000, cursor: 'c1' })
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['GET', '/v1/convai/v2/phone-numbers'])
    expect(Object.fromEntries(c.url.searchParams)).toEqual({ phone_number: '+40312345678', provider: 'twilio', cursor: 'c1', page_size: '100' })
  })

  it('findImportedNumber pages until the EXACT number (substring matches are ignored)', async () => {
    fetchMock
      .mockResolvedValueOnce(page([{ phone_number_id: 'p0', phone_number: '+403123456789', label: 'x' }], 'next'))
      .mockResolvedValueOnce(page([{ phone_number_id: 'p1', phone_number: '+40 312 345 678', label: 'ntv:production:x', assigned_agent: null }]))
    const hit = await phones.findImportedNumber('+40312345678')
    expect(hit?.phone_number_id).toBe('p1')
    expect(callAt(fetchMock, 1).url.searchParams.get('cursor')).toBe('next')
  })

  it('findImportedNumber gives up after maxPages and on an invalid number', async () => {
    fetchMock.mockImplementation(async () => page([], 'more'))
    expect(await phones.findImportedNumber('+40312345678', { maxPages: 2 })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await phones.findImportedNumber('not a number')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('collectImportedNumbers reports truncation', async () => {
    fetchMock.mockImplementation(async () => page([{ phone_number_id: 'p', phone_number: '+40312345678', label: 'ntv:production:x' }], 'more'))
    const res = await phones.collectImportedNumbers({ label: 'ntv:production:' }, { maxPages: 3 })
    expect(res).toMatchObject({ truncated: true })
    expect(res.numbers).toHaveLength(3)
    expect(callAt(fetchMock).url.searchParams.get('label')).toBe('ntv:production:')
  })
})

describe('client.ts phone numbers and outbound call', () => {
  it('there is no workspace-wide v1 listing any more', () => {
    expect((el.phoneNumbers as Record<string, unknown>).list).toBeUndefined()
  })

  it('importTwilio is never retried and update carries label + agent_id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: { message: 'boom' } }, 503))
    await expect(el.phoneNumbers.importTwilio({ phone_number: '+40312345678', label: 'ntv:production:o', agent_id: 'a', sid: 'AC1', token: 't' })).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callAt(fetchMock).json).toMatchObject({ provider: 'twilio', enable_sms: false, label: 'ntv:production:o' })
    fetchMock.mockResolvedValueOnce(jsonResponse({ phone_number_id: 'p', phone_number: '+40312345678' }))
    await el.phoneNumbers.update('p', { agent_id: 'a', label: 'ntv:production:o' })
    const c = callAt(fetchMock, 1)
    expect([c.method, c.url.pathname, c.json]).toEqual(['PATCH', '/v1/convai/phone-numbers/p', { agent_id: 'a', label: 'ntv:production:o' }])
  })

  it('outboundCall: sends telephony_call_config, is never retried and never feeds the shared routing circuit', async () => {
    for (let i = 0; i < 5; i++) {
      fetchMock.mockRejectedValueOnce(timeoutError())
      await expect(
        el.twilio.outboundCall({ agent_id: 'a', agent_phone_number_id: 'p', to_number: '+40722222222', telephony_call_config: { ringing_timeout_secs: OUTBOUND_RING_TIMEOUT_S } }),
      ).rejects.toMatchObject({ code: 'timeout' })
    }
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(callAt(fetchMock).json).toMatchObject({ telephony_call_config: { ringing_timeout_secs: 30 } })
    expect((await peek('elevenlabs')).state).toBe('closed')
  })
})

describe('initiation webhook block', () => {
  it('references the workspace secret by id (never a value) in the header', () => {
    expect(initiationWebhookBlock('https://voice.example.com/api/elevenlabs/initiation', 'sec_1')).toEqual({
      url: 'https://voice.example.com/api/elevenlabs/initiation',
      request_headers: { 'X-NTV-Tool-Key': { secret_id: 'sec_1' } },
    })
  })
})
