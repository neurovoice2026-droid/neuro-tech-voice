import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

const api = vi.hoisted(() => ({ getVoiceQuota: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/voices', () => api)

import { ProviderError } from './errors'
import {
  VoiceCapacityError,
  assertCustomVoiceCap,
  assertCustomVoicePlan,
  assertWorkspaceVoiceCapacity,
  capViolationAfterInsert,
  customVoicesAllowed,
  isVoiceCapacityProviderError,
  maxCustomVoicesPerOrg,
  quotaBlocker,
  resetVoiceQuotaCache,
} from './voice-capacity'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const log = createLogger({ test: true })
const voice = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `r-${id}`, provider: 'elevenlabs', voice_id: id, owner_org_id: ORG, source: 'cloned', status: 'ready', created_at: `2026-10-0${id.slice(-1)}T00:00:00Z`, ...extra,
})

beforeEach(() => {
  resetVoiceQuotaCache()
  api.getVoiceQuota.mockReset()
})

describe('plan gate', () => {
  it('follows the entitlement table: trial and starter cannot create custom voices; unknown plans get trial rights', () => {
    expect(customVoicesAllowed('trial')).toBe(false)
    expect(customVoicesAllowed('starter')).toBe(false)
    expect(customVoicesAllowed('pro')).toBe(true)
    expect(customVoicesAllowed('business')).toBe(true)
    expect(customVoicesAllowed('custom')).toBe(true)
    expect(customVoicesAllowed(null)).toBe(false)
    expect(customVoicesAllowed('enterprise-hack')).toBe(false)
    expect(() => assertCustomVoicePlan('starter')).toThrow(expect.objectContaining({ status: 403, details: { reason: 'plan', required_plan: 'pro' } }))
    expect(() => assertCustomVoicePlan('pro')).not.toThrow()
  })
})

describe('per-org cap', () => {
  it('defaults to 2, env-configurable within 0–50', () => {
    expect(maxCustomVoicesPerOrg()).toBe(2)
    vi.stubEnv('ELEVENLABS_MAX_CLONES_PER_ORG', '5')
    expect(maxCustomVoicesPerOrg()).toBe(5)
    vi.stubEnv('ELEVENLABS_MAX_CLONES_PER_ORG', '-1')
    expect(maxCustomVoicesPerOrg()).toBe(2)
    vi.stubEnv('ELEVENLABS_MAX_CLONES_PER_ORG', 'abc')
    expect(maxCustomVoicesPerOrg()).toBe(2)
  })

  it('counts ready/pending cloned and designed voices of the org only', async () => {
    const db = memoryDb({
      provider_voices: [
        voice('V1'),
        voice('V2', { source: 'designed' }),
        voice('V3', { status: 'deleted' }),
        voice('V4', { owner_org_id: '99999999-9999-4999-8999-999999999999' }),
        voice('V5', { source: 'library', owner_org_id: null }),
      ],
    })
    await expect(assertCustomVoiceCap(db as never, ORG)).rejects.toMatchObject({ status: 409, details: { reason: 'custom_voice_limit', limit: 2 } })
    vi.stubEnv('ELEVENLABS_MAX_CLONES_PER_ORG', '3')
    await expect(assertCustomVoiceCap(db as never, ORG)).resolves.toBeUndefined()
  })

  it('after insert: the oldest voices win, the one over the cap is reported', async () => {
    const db = memoryDb({ provider_voices: [voice('V1'), voice('V2'), voice('V3')] })
    expect(await capViolationAfterInsert(db as never, ORG, 'V2')).toBeNull()
    expect(await capViolationAfterInsert(db as never, ORG, 'V3')).toMatchObject({ status: 409 })
  })
})

describe('workspace quota preflight', () => {
  it('blocks on cloning unavailable, full voice slots and the add/edit limit; library adds ignore slots', () => {
    expect(quotaBlocker({ can_use_instant_voice_cloning: false }, 'clone')).toBe('ivc_unavailable')
    expect(quotaBlocker({ can_use_instant_voice_cloning: false }, 'design')).toBeNull()
    expect(quotaBlocker({ voice_slots_used: 30, voice_limit: 30 }, 'clone')).toBe('voice_slots_full')
    expect(quotaBlocker({ voice_slots_used: 30, voice_limit: 30 }, 'library')).toBeNull()
    expect(quotaBlocker({ voice_add_edit_counter: 95, max_voice_add_edits: 95 }, 'library')).toBe('voice_add_edit_limit')
    expect(quotaBlocker({ voice_add_edit_counter: 5, max_voice_add_edits: null, voice_slots_used: 1, voice_limit: 30 }, 'clone')).toBeNull()
  })

  it('throws VoiceCapacityError when full, fails open when the quota cannot be read, caches 60 s', async () => {
    api.getVoiceQuota.mockResolvedValueOnce({ voice_slots_used: 10, voice_limit: 10 })
    await expect(assertWorkspaceVoiceCapacity('clone', log)).rejects.toBeInstanceOf(VoiceCapacityError)
    await expect(assertWorkspaceVoiceCapacity('library', log)).resolves.toBeUndefined()
    expect(api.getVoiceQuota).toHaveBeenCalledTimes(1)
    resetVoiceQuotaCache()
    api.getVoiceQuota.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'user.subscription', code: 'auth', status: 401 }))
    await expect(assertWorkspaceVoiceCapacity('clone', log)).resolves.toBeUndefined()
  })

  it('recognises provider refusals for a full workspace on voice-adding calls only', () => {
    const pe = (operation: string, code: 'validation' | 'quota', detail?: string) => new ProviderError({ system: 'elevenlabs', operation, code, detail })
    expect(isVoiceCapacityProviderError(pe('voices.ivc', 'validation', 'voice_limit_reached - You have reached your maximum'))).toBe(true)
    expect(isVoiceCapacityProviderError(pe('shared_voices.add', 'quota'))).toBe(true)
    expect(isVoiceCapacityProviderError(pe('voices.create_from_preview', 'validation', 'voice_add_edit_limit_reached'))).toBe(true)
    expect(isVoiceCapacityProviderError(pe('tts.convert', 'quota'))).toBe(false)
    expect(isVoiceCapacityProviderError(pe('voices.ivc', 'validation', 'invalid_file'))).toBe(false)
    expect(isVoiceCapacityProviderError(new Error('x'))).toBe(false)
  })
})
