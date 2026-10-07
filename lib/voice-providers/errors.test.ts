import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyHttpError, isHealthSignalCode, parseProviderErrorBody, summarizeErrorBody } from './errors'
import { providerRequest } from './http'
import { MemoryCircuitStore } from './circuit-breaker'
import { peek, setCircuitStore } from './circuit-registry'
import { setProviderEventSink } from '@/lib/observability/telemetry'

const body = (detail: Record<string, unknown>) => JSON.stringify({ detail })

describe('parseProviderErrorBody', () => {
  it('reads the documented detail object and prefers code over the legacy status', () => {
    expect(parseProviderErrorBody(body({ type: 'rate_limit_error', code: 'system_busy', status: 'system_busy', message: 'The system is currently busy', request_id: 'req_123', param: null })))
      .toEqual({ code: 'system_busy', type: 'rate_limit_error', message: 'The system is currently busy', param: null, requestId: 'req_123' })
    expect(parseProviderErrorBody(body({ status: 'voice_not_found', message: 'x' }))?.code).toBe('voice_not_found')
  })

  it('ignores non-JSON, arrays and non-token values', () => {
    expect(parseProviderErrorBody('<html>')).toBeNull()
    expect(parseProviderErrorBody(JSON.stringify({ detail: [{ loc: ['body'], msg: 'x' }] }))).toBeNull()
    expect(parseProviderErrorBody(body({ code: 'has spaces and +40712345678' }))?.code ?? null).toBeNull()
  })
})

describe('summarizeErrorBody', () => {
  it('does not repeat the code when status mirrors it, and keeps param and request_id', () => {
    const s = summarizeErrorBody(body({ type: 'validation_error', code: 'invalid_parameters', status: 'invalid_parameters', message: 'Bad value', param: 'platform_settings.call_limits', request_id: 'req_9' }))
    expect(s).toBe('invalid_parameters - param platform_settings.call_limits - Bad value request_id req_9')
    expect(s?.match(/invalid_parameters/g)).toHaveLength(1)
  })

  it('redacts phone numbers and secrets from the message', () => {
    const s = summarizeErrorBody(body({ code: 'invalid_text', message: 'caller +40712345678 key sk_abcdefghijklmnop' }))
    expect(s).not.toContain('+40712345678')
    expect(s).not.toContain('sk_abcdefghijklmnop')
  })
})

describe('classifyHttpError', () => {
  it('keeps workspace-wide 429s as a health signal', () => {
    for (const code of ['concurrent_limit_exceeded', 'system_busy', 'rate_limit_exceeded']) {
      const c = classifyHttpError(429, body({ code, message: 'Maximum number of concurrent requests exceeded' }))
      expect(c.code).toBe('rate_limited')
      expect(isHealthSignalCode(c.code)).toBe(true)
    }
    // No structured body (gateway, proxy): unchanged behaviour.
    expect(classifyHttpError(429, 'Too Many Requests').code).toBe('rate_limited')
  })

  it('scopes per-agent concurrency and daily limits to the tenant (never a health signal)', () => {
    const daily = classifyHttpError(429, body({ code: 'daily_limit_exceeded', message: 'Agent daily call limit reached' }))
    expect(daily.code).toBe('tenant_limited')
    expect(isHealthSignalCode(daily.code)).toBe(false)
    expect(classifyHttpError(429, body({ code: 'concurrent_limit_exceeded', message: 'This agent reached its concurrency limit' })).code).toBe('tenant_limited')
    // Unknown code: tenant-scoped unless the message names the workspace.
    expect(classifyHttpError(429, body({ code: 'agent_limit', message: 'Limit reached' })).code).toBe('tenant_limited')
    expect(classifyHttpError(429, body({ code: 'burst_capacity_exhausted', message: 'Workspace burst capacity exhausted' })).code).toBe('rate_limited')
  })

  it('maps 403 codes precisely and keeps 401 as auth', () => {
    expect(classifyHttpError(401, body({ code: 'invalid_api_key', message: 'x' })).code).toBe('auth')
    expect(classifyHttpError(403, body({ code: 'insufficient_permissions', message: 'x' })).code).toBe('permission')
    const plan = classifyHttpError(403, body({ code: 'feature_not_available', message: 'x' }))
    expect(plan.code).toBe('permission')
    expect(plan.safeMessage).toMatch(/plan/)
    const voice = classifyHttpError(403, body({ code: 'voice_access_denied', message: 'x' }))
    expect(voice.code).toBe('validation')
    expect(voice.safeMessage).toMatch(/voice/i)
    expect(classifyHttpError(403, body({ code: 'model_access_denied', message: 'x' })).code).toBe('validation')
    // Without a code a 403 stays an authentication problem (previous behaviour).
    expect(classifyHttpError(403, '').code).toBe('auth')
  })

  it('never puts request_id or param into the browser-safe message', () => {
    const c = classifyHttpError(403, body({ code: 'voice_access_denied', message: 'x', request_id: 'req_secretish' }))
    expect(c.safeMessage).not.toContain('req_')
    expect(c.detail).toContain('request_id req_secretish')
  })
})

describe('providerRequest with tenant-scoped 429 on a breaker-enabled call', () => {
  let restore: () => void
  beforeEach(() => {
    setCircuitStore(new MemoryCircuitStore())
    restore = setProviderEventSink(() => {})
  })
  afterEach(() => {
    restore()
    setCircuitStore(null)
    vi.unstubAllGlobals()
  })

  it('does not count tenant limits against the shared circuit, but does count workspace overload', async () => {
    const tenant = () => Promise.resolve(new Response(body({ code: 'daily_limit_exceeded', message: 'Agent daily limit reached' }), { status: 429 }))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(tenant))
    for (let i = 0; i < 5; i++) {
      await expect(
        providerRequest({ system: 'elevenlabs', operation: 'twilio.register_call', url: 'https://x.test', method: 'POST', body: {}, timeoutMs: 1000, breaker: true, retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 } }),
      ).rejects.toMatchObject({ code: 'tenant_limited', providerCode: 'daily_limit_exceeded' })
    }
    expect((await peek('elevenlabs')).raw.consecutiveFailures).toBe(0)

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(body({ code: 'system_busy', message: 'The system is currently busy' }), { status: 429 }))))
    await expect(
      providerRequest({ system: 'elevenlabs', operation: 'twilio.register_call', url: 'https://x.test', method: 'POST', body: {}, timeoutMs: 1000, breaker: true, retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 } }),
    ).rejects.toMatchObject({ code: 'rate_limited' })
    expect((await peek('elevenlabs')).raw.consecutiveFailures).toBe(1)
  })
})
