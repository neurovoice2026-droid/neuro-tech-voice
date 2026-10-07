// Which initiation webhook an agent with native numbers is synced with.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/lib/observability/logger'

const res = vi.hoisted(() => ({ readResourceRow: vi.fn(), isReadyRow: (row: { status?: string; external_id?: string } | null) => !!row && row.status === 'ready' && !!row.external_id }))
vi.mock('@/lib/voice-providers/platform-resources', () => res)
const tools = vi.hoisted(() => ({ ensureToolSecret: vi.fn() }))
vi.mock('@/lib/voice-providers/platform-tools', () => tools)

import { initiationWebhookFor } from './initiation-config'

const log = createLogger({ test: 'initiation-config' })

beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
  vi.stubEnv('ELEVENLABS_TOOL_SECRET', 's'.repeat(40))
  res.readResourceRow.mockReset().mockResolvedValue({ status: 'ready', external_id: 'sec_1', details: {} })
  tools.ensureToolSecret.mockReset().mockResolvedValue('sec_1')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('initiationWebhookFor', () => {
  it('write: obtains the secret id (created on first use) and our HTTPS URL', async () => {
    expect(await initiationWebhookFor('write', log)).toEqual({ url: 'https://voice.example.com/api/elevenlabs/initiation', secretId: 'sec_1' })
    expect(tools.ensureToolSecret).toHaveBeenCalledWith(expect.objectContaining({ verify: 'cached' }))
  })

  it('hash: reads the stored id only, never creating anything', async () => {
    expect(await initiationWebhookFor('hash', log)).toEqual({ url: 'https://voice.example.com/api/elevenlabs/initiation', secretId: 'sec_1' })
    expect(tools.ensureToolSecret).not.toHaveBeenCalled()
    res.readResourceRow.mockResolvedValueOnce(null)
    expect(await initiationWebhookFor('hash', log)).toBeNull()
  })

  it('no webhook without the secret, without HTTPS, or when the secret cannot be obtained', async () => {
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', '')
    expect(await initiationWebhookFor('write', log)).toBeNull()
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', 's'.repeat(40))
    vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'http://localhost:3000')
    expect(await initiationWebhookFor('write', log)).toBeNull()
    vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
    tools.ensureToolSecret.mockRejectedValueOnce(new Error('secrets down'))
    expect(await initiationWebhookFor('write', log)).toBeNull()
  })
})
