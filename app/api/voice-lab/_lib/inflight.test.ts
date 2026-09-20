import { beforeEach, describe, expect, it, vi } from 'vitest'

const kv = vi.hoisted(() => new Map<string, number>())

vi.mock('@/lib/kv', () => ({
  kvIncr: async (key: string) => {
    const next = (kv.get(key) ?? 0) + 1
    kv.set(key, next)
    return next
  },
  kvDel: async (key: string) => {
    kv.delete(key)
  },
}))

const { acquireToolSlot, requireActiveTrial } = await import('./inflight')

const ORG = '0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b'

beforeEach(() => kv.clear())

describe('Voice Lab tool slots (SEC-06)', () => {
  it('lets one job per organisation and tool run, so parallel requests cannot all pass the allowance check', async () => {
    const release = await acquireToolSlot(ORG, 'stt_tool')
    await expect(acquireToolSlot(ORG, 'stt_tool')).rejects.toMatchObject({ status: 429, code: 'tool_busy' })
    // Other tools and other organisations aren't blocked.
    const tts = await acquireToolSlot(ORG, 'tts_tool')
    const other = await acquireToolSlot('11111111-2222-4333-8444-555555555555', 'stt_tool')
    await release()
    await release()
    const again = await acquireToolSlot(ORG, 'stt_tool')
    await Promise.all([again(), tts(), other()])
    expect(kv.size).toBe(0)
  })

  it('refuses the Voice Lab once a trial has ended', () => {
    expect(() => requireActiveTrial({ plan: 'trial', trial_ends_at: '2020-01-01T00:00:00Z' })).toThrow(/trial has ended/)
    expect(() => requireActiveTrial({ plan: 'trial', trial_ends_at: '2999-01-01T00:00:00Z' })).not.toThrow()
    expect(() => requireActiveTrial({ plan: 'pro', trial_ends_at: '2020-01-01T00:00:00Z' })).not.toThrow()
  })
})
