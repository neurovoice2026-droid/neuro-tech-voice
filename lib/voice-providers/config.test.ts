import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateVoiceConfig } from './config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('validateVoiceConfig', () => {
  it('does not warn about a missing ELEVENLABS_POST_CALL_WEBHOOK_ID: the discovered id is checked by webhook-health', () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test-key')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'test-webhook-secret')
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', '')
    const keys = validateVoiceConfig().map((p) => p.key)
    expect(keys).not.toContain('ELEVENLABS_POST_CALL_WEBHOOK_ID')
    expect(keys).not.toContain('ELEVENLABS_WEBHOOK_SECRET')
  })

  it('still reports the ElevenLabs settings webhooks cannot work without', () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test-key')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', '')
    expect(validateVoiceConfig()).toContainEqual(expect.objectContaining({ key: 'ELEVENLABS_WEBHOOK_SECRET', severity: 'error' }))
  })
})
