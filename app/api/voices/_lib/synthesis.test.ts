import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  afterCallbacks: [] as (() => unknown)[],
  exhausted: [] as string[],
}))

vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    runtime.afterCallbacks.push(callback)
  },
}))

vi.mock('@/lib/voice/budget', () => ({
  markBudgetExhausted: async (budget: string) => {
    runtime.exhausted.push(budget)
  },
}))

import { ApiError } from '@/lib/api/http'
import { CartesiaError } from '@/lib/cartesia/client'
import { toVoiceApiError } from './synthesis'

function cartesiaError(status: number, errorCode: string | null = null): CartesiaError {
  return new CartesiaError({ status, errorCode, endpoint: 'POST /tts/bytes', message: `Cartesia failed ${status}` })
}

describe('toVoiceApiError', () => {
  beforeEach(() => {
    runtime.afterCallbacks.length = 0
    runtime.exhausted.length = 0
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('passes our own errors through and rethrows anything that is not a provider error', () => {
    const own = new ApiError(503, 'not_configured', 'Not configured')
    expect(toVoiceApiError(own, 'tts')).toBe(own)
    const bug = new TypeError('boom')
    expect(() => toVoiceApiError(bug, 'tts')).toThrow(bug)
  })

  it('marks model credits exhausted on a quota error and words it for the tool', async () => {
    const tts = toVoiceApiError(cartesiaError(402, 'quota_exceeded'), 'tts')
    expect(tts.status).toBe(503)
    expect(tts.code).toBe('voice_capacity_reached')
    expect(tts.message).toMatch(/^Audio generation is paused/)
    expect(toVoiceApiError(cartesiaError(429, 'quota_exceeded'), 'stt').message).toMatch(/^Transcription is paused/)

    expect(runtime.afterCallbacks).toHaveLength(2)
    await Promise.all(runtime.afterCallbacks.map((callback) => callback()))
    expect(runtime.exhausted).toEqual(['model_credits', 'model_credits'])
  })

  it('keeps the provider plan separate from the customer plan', () => {
    const clone = toVoiceApiError(cartesiaError(403, 'plan_upgrade_required'), 'clone')
    expect(clone.status).toBe(503)
    expect(clone.code).toBe('provider_plan_required')
    expect(clone.message).toMatch(/^Voice cloning is temporarily unavailable on our side/)
    expect(clone.code).not.toBe('upgrade_required')
    expect(toVoiceApiError(cartesiaError(403, 'plan_upgrade_required'), 'tts').message).toMatch(/^This feature/)
  })

  it('treats a rejected key as our configuration problem, never the customer’s', () => {
    const error = toVoiceApiError(cartesiaError(401), 'catalog')
    expect(error.status).toBe(503)
    expect(error.code).toBe('not_configured')
  })

  it('maps missing voices, busy upstream and bad requests to actionable messages', () => {
    expect(toVoiceApiError(cartesiaError(404, 'voice_not_found'), 'preview').code).toBe('voice_unavailable')
    expect(toVoiceApiError(cartesiaError(404), 'tts').code).toBe('voice_unavailable')

    const busy = toVoiceApiError(cartesiaError(429), 'tts')
    expect(busy.code).toBe('voice_busy')
    expect(busy.headers).toEqual({ 'Retry-After': '5' })

    expect(toVoiceApiError(cartesiaError(400), 'stt').message).toMatch(/transcribe this file/)
    expect(toVoiceApiError(cartesiaError(400), 'tts').code).toBe('unsupported_request')
    expect(toVoiceApiError(cartesiaError(413, 'file_too_large'), 'clone').status).toBe(413)
  })

  it('never forwards the upstream message on provider outages', () => {
    const outage = toVoiceApiError(cartesiaError(500), 'clone')
    expect(outage.status).toBe(502)
    expect(outage.code).toBe('provider_error')
    expect(outage.message).not.toContain('Cartesia failed')
    expect(toVoiceApiError(cartesiaError(0, 'timeout'), 'stt').message).toMatch(/transcribe this file right now/)
  })
})
