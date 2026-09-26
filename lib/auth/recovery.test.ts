import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, unknown>())

vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => (store.has(key) ? store.get(key) : null),
  kvSet: async (key: string, value: unknown) => {
    store.set(key, value)
  },
  kvDel: async (key: string) => {
    store.delete(key)
  },
}))

const { consumeRecoveryGrant, hasRecoveryGrant, issueRecoveryGrant } = await import('./recovery')

const USER = '5f1c2d3e-4a5b-4c6d-8e7f-901234567890'
const OTHER = '6a1c2d3e-4a5b-4c6d-8e7f-901234567891'

beforeEach(() => store.clear())

describe('password recovery grant (SEC-05)', () => {
  it('accepts only the nonce from the reset link, for that user, until it is used', async () => {
    const nonce = await issueRecoveryGrant(USER)
    expect(nonce.length).toBeGreaterThanOrEqual(40)
    // Only a hash is stored.
    expect(JSON.stringify([...store.values()])).not.toContain(nonce)

    expect(await hasRecoveryGrant(USER, nonce)).toBe(true)
    expect(await hasRecoveryGrant(OTHER, nonce)).toBe(false)
    expect(await hasRecoveryGrant(USER, `${nonce}x`)).toBe(false)
    expect(await hasRecoveryGrant(USER, null)).toBe(false)
    expect(await hasRecoveryGrant(USER, '')).toBe(false)

    await consumeRecoveryGrant(USER)
    expect(await hasRecoveryGrant(USER, nonce)).toBe(false)
  })

  it('refuses a signed-in session that never opened a reset link', async () => {
    expect(await hasRecoveryGrant(USER, 'guessed-cookie-value')).toBe(false)
  })
})
