import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const kvStore = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => (kvStore.has(key) ? kvStore.get(key) : null),
  kvSet: async (key: string, value: unknown) => {
    kvStore.set(key, value)
  },
  kvDel: async (key: string) => {
    kvStore.delete(key)
  },
}))

const api = vi.hoisted(() => ({ voicesGet: vi.fn() }))
vi.mock('@/lib/cartesia/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cartesia/client')>()
  return { ...actual, cartesia: { ...actual.cartesia, voices: { ...actual.cartesia.voices, get: api.voicesGet } } }
})

const { forgetVoiceFacts, getVoiceFacts, isOtherOrgClone, resolveSelectableVoice } = await import('./voices')
const { CartesiaError } = await import('@/lib/cartesia/client')
const { DEFAULT_CARTESIA_VOICES } = await import('@/lib/voice/voice-map')

type Result = { data: unknown; error: { code?: string; message: string } | null }

/** Records every filter and answers each query with `result`. */
function fakeClient(result: Result) {
  const calls: [string, unknown[]][] = []
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'select', 'eq', 'neq', 'limit', 'maybeSingle']) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args])
      return chain
    }
  }
  chain.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve)
  return { client: chain as unknown as SupabaseClient, calls }
}

const ORG = '22222222-2222-4222-8222-222222222222'
const CLONE = { id: 'clone-1', name: 'Owner voice', gender: 'feminine', is_pro: false, is_owner: true }

beforeEach(() => {
  kvStore.clear()
  api.voicesGet.mockReset()
  vi.stubEnv('CARTESIA_API_KEY', 'sk_car_test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getVoiceFacts', () => {
  it('knows the default voices offline, caches others and reports missing voices as null', async () => {
    const skylar = DEFAULT_CARTESIA_VOICES.en.feminine
    expect(await getVoiceFacts(skylar.voice_id)).toMatchObject({ name: skylar.name, is_pro: false })
    expect(api.voicesGet).not.toHaveBeenCalled()

    api.voicesGet.mockResolvedValueOnce({ id: 'voice-x', name: 'Nova', gender: 'masculine', is_pro: true, is_owner: false })
    expect(await getVoiceFacts('voice-x')).toMatchObject({ is_pro: true, gender: 'masculine' })
    await getVoiceFacts('voice-x')
    expect(api.voicesGet).toHaveBeenCalledTimes(1)

    await forgetVoiceFacts('voice-x')
    api.voicesGet.mockRejectedValueOnce(new CartesiaError({ status: 404, errorCode: 'voice_not_found', message: 'gone' }))
    expect(await getVoiceFacts('voice-x')).toBeNull()
  })
})

describe('resolveSelectableVoice', () => {
  it('accepts a cloned voice only for the organisation that owns it', async () => {
    api.voicesGet.mockResolvedValue(CLONE)
    const own = fakeClient({ data: { id: 'row-1' }, error: null })
    await expect(resolveSelectableVoice(own.client, ORG, 'clone-1')).resolves.toMatchObject({ id: 'clone-1' })
    expect(own.calls).toContainEqual(['eq', ['org_id', ORG]])

    const foreign = fakeClient({ data: null, error: null })
    await expect(resolveSelectableVoice(foreign.client, ORG, 'clone-1')).rejects.toMatchObject({ status: 400, code: 'voice_not_found' })
  })

  it('answers a clear error when Cartesia can’t be reached', async () => {
    api.voicesGet.mockRejectedValue(new CartesiaError({ status: 0, errorCode: 'timeout', message: 'timed out' }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(resolveSelectableVoice(fakeClient({ data: null, error: null }).client, ORG, 'voice-y')).rejects.toMatchObject({
      status: 502,
      code: 'voice_lookup_failed',
    })
    error.mockRestore()
  })
})

describe('isOtherOrgClone', () => {
  it('asks only about other organisations', async () => {
    const other = fakeClient({ data: [{ id: 'row-9' }], error: null })
    expect(await isOtherOrgClone(other.client, ORG, 'clone-1')).toBe(true)
    expect(other.calls).toContainEqual(['eq', ['cartesia_voice_id', 'clone-1']])
    expect(other.calls).toContainEqual(['neq', ['org_id', ORG]])

    expect(await isOtherOrgClone(fakeClient({ data: [], error: null }).client, ORG, 'voice-lib')).toBe(false)
  })

  it('treats a missing table as no clones and other failures as errors', async () => {
    const missing = fakeClient({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    expect(await isOtherOrgClone(missing.client, ORG, 'clone-1')).toBe(false)

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = fakeClient({ data: null, error: { code: '57014', message: 'statement timeout' } })
    await expect(isOtherOrgClone(broken.client, ORG, 'clone-1')).rejects.toMatchObject({ code: 'voice_lookup_failed' })
    error.mockRestore()
  })
})
