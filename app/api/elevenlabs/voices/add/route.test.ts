import { describe, expect, it, vi } from 'vitest'

// The legacy endpoint provisioned a library voice into the SHARED workspace
// without applying it to the caller's agent (quota abuse). It is gone: the
// voice pickers use PUT /api/agent/voice, which provisions AND applies.
const catalog = vi.hoisted(() => ({ provisionLibraryVoice: vi.fn(), assertVoiceEligible: vi.fn() }))
vi.mock('@/lib/voice-providers/voice-catalog', () => catalog)
const auth = vi.hoisted(() => ({ requireOrg: vi.fn() }))
vi.mock('@/lib/api/auth', () => auth)

import { POST } from './route'

describe('POST /api/elevenlabs/voices/add', () => {
  it('answers 410 Gone and never provisions anything', async () => {
    const res = await POST(
      new Request('http://app.test/api/elevenlabs/voices/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://app.test', host: 'app.test' },
        body: JSON.stringify({ public_owner_id: 'a'.repeat(64), voice_id: 'LibVoice000000000001' }),
      }),
    )
    expect(res.status).toBe(410)
    expect(await res.json()).toMatchObject({ details: { replacement: 'PUT /api/agent/voice' } })
    expect(catalog.provisionLibraryVoice).not.toHaveBeenCalled()
    expect(catalog.assertVoiceEligible).not.toHaveBeenCalled()
    expect(auth.requireOrg).not.toHaveBeenCalled()
  })
})
