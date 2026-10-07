import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/voice-providers/platform-resources', () => ({ readResourceRow: vi.fn(), isReadyRow: vi.fn(), pinnedResourceId: vi.fn() }))

import { allowToolCall, sanitizeToolText, toolJson } from './elevenlabs-tool'

describe('tool route helpers', () => {
  it('sanitizeToolText: one line, no control characters, digit runs masked, capped', () => {
    expect(sanitizeToolText('  wants\tbilling\n\nplease  ')).toBe('wants billing please')
    expect(sanitizeToolText('call 0721 234 567 or +40-721-234-567, card 4111 1111 1111 1111')).toBe('call [number] or [number], card [number]')
    expect(sanitizeToolText('room 12, floor 3')).toBe('room 12, floor 3')
    expect(sanitizeToolText('x'.repeat(500))).toHaveLength(200)
    expect(sanitizeToolText('abc', 2)).toBe('ab')
  })

  it('allowToolCall: a per-call budget (memory limiter in tests), independent per call and per tool', async () => {
    const call = `call-${Math.random()}`
    const results: boolean[] = []
    for (let i = 0; i < 7; i++) results.push(await allowToolCall('transfer', call))
    expect(results).toEqual([true, true, true, true, true, true, false])
    expect(await allowToolCall('transfer', `${call}-other`)).toBe(true)
    expect(await allowToolCall('book', call)).toBe(true)
  })

  it('toolJson: never cached', async () => {
    const res = toolJson({ ok: false, message: 'm' }, 401)
    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: false, message: 'm' })
  })
})
