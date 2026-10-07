import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: vi.fn(() => true) }))
vi.mock('@/lib/elevenlabs/api/tools', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/elevenlabs/api/tools')>()
  return { collectPages: real.collectPages, createTool: vi.fn(), getTool: vi.fn(), updateTool: vi.fn(), deleteTool: vi.fn(), listTools: vi.fn() }
})
vi.mock('@/lib/elevenlabs/api/secrets', () => ({ createSecret: vi.fn(), updateSecret: vi.fn(), getSecret: vi.fn(), listSecrets: vi.fn(), deleteSecret: vi.fn() }))

import * as toolsApi from '@/lib/elevenlabs/api/tools'
import * as secretsApi from '@/lib/elevenlabs/api/secrets'
import { ProviderError } from './errors'
import { resetPlatformResourceMemo } from './platform-resources'
import { PLATFORM_TOOL_KEYS, TRANSFER_TOOL } from '@/lib/elevenlabs/tools/definitions'
import { buildWebhookToolConfig } from '@/lib/elevenlabs/tools/webhook-tool'
import { secretFingerprint, toolConfigHash } from '@/lib/elevenlabs/tools/hash'
import {
  ensurePlatformTool,
  ensureToolSecret,
  reconcilePlatformTools,
  remoteToolDrift,
  resetPlatformToolMemo,
  storedPlatformToolId,
  toolSecretName,
} from './platform-tools'

const BASE = 'https://voice.example.com'
const KEY = 'tool-key-0123456789abcdef-0123456789abcdef'
const KEY_2 = 'tool-key-rotated-0123456789abcdef-01234567'
const T = 'elevenlabs.transfer_tool' as const
const S = 'elevenlabs.tool_secret' as const

const notFound = (op: string) => new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: op })
const rows = () => state.db!.tables.platform_resources ?? []
const row = (key: string) => rows().find((r) => r.key === key)
const desired = (secretId: string | null = 'sec_1', base = BASE) => buildWebhookToolConfig(TRANSFER_TOOL, { baseUrl: base, toolKeySecretId: secretId })

function seed(initial: Array<Record<string, unknown>> = []) {
  state.db = memoryDb({ platform_resources: initial.map((r) => ({ status: 'ready', details: {}, monitor: {}, ...r })) }, { unique: { platform_resources: [['key']] } })
}

beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', BASE)
  vi.stubEnv('ELEVENLABS_TOOL_SECRET', KEY)
  vi.stubEnv('ELEVENLABS_TRANSFER_TOOL_ID', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetPlatformToolMemo()
  resetPlatformResourceMemo()
  for (const fn of [toolsApi.createTool, toolsApi.getTool, toolsApi.updateTool, toolsApi.deleteTool, toolsApi.listTools]) vi.mocked(fn).mockReset()
  for (const fn of [secretsApi.createSecret, secretsApi.updateSecret, secretsApi.getSecret, secretsApi.listSecrets, secretsApi.deleteSecret]) vi.mocked(fn).mockReset()
  vi.mocked(toolsApi.listTools).mockResolvedValue({ tools: [], has_more: false })
  vi.mocked(toolsApi.createTool).mockResolvedValue({ id: 'tool_1', tool_config: {} })
  vi.mocked(toolsApi.getTool).mockImplementation(async (id) => ({ id, tool_config: desired() }))
  vi.mocked(toolsApi.updateTool).mockImplementation(async (id) => ({ id, tool_config: {} }))
  vi.mocked(secretsApi.listSecrets).mockResolvedValue({ secrets: [] })
  vi.mocked(secretsApi.createSecret).mockResolvedValue({ secret_id: 'sec_1', name: 'n' })
  vi.mocked(secretsApi.updateSecret).mockResolvedValue({ secret_id: 'sec_1', name: 'n' })
  seed()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('first use: secret then tool, created once, remembered with their fingerprints', () => {
  it('creates the workspace secret and the tool (header auth with the secret id) and stores hashes, never the value', async () => {
    const res = await ensurePlatformTool(T, { verify: 'cached' })
    expect(res).toEqual({ key: T, toolId: 'tool_1', action: 'created' })
    expect(secretsApi.createSecret).toHaveBeenCalledWith({ name: toolSecretName(BASE), value: KEY })
    expect(toolsApi.createTool).toHaveBeenCalledWith(desired('sec_1'))
    expect(row(S)).toMatchObject({ external_id: 'sec_1', status: 'ready', lease_owner: null, details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } })
    expect(row(T)).toMatchObject({ external_id: 'tool_1', status: 'ready', lease_owner: null, details: { config_hash: toolConfigHash(desired('sec_1')), auth: 'headers' } })
    expect(JSON.stringify(rows())).not.toContain(KEY)
  })

  it('a second ensure on the sync path makes no provider call', async () => {
    await ensurePlatformTool(T, { verify: 'cached' })
    vi.mocked(toolsApi.getTool).mockClear()
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1', action: 'cached' })
    expect(toolsApi.getTool).not.toHaveBeenCalled()
    expect(toolsApi.createTool).toHaveBeenCalledTimes(1)
  })

  it('adopts a tool left behind by a crash (same name, same URL) instead of creating a duplicate', async () => {
    vi.mocked(toolsApi.listTools).mockResolvedValue({
      tools: [
        { id: 'tool_other_env', tool_config: { type: 'webhook', name: 'transfer_to_human', api_schema: { url: 'https://staging.example.com/api/telephony/tools/transfer' } } },
        { id: 'tool_orphan', tool_config: { type: 'webhook', name: 'transfer_to_human', api_schema: { url: `${BASE}/api/telephony/tools/transfer` } } },
      ],
      has_more: false,
    })
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_orphan', action: 'adopted' })
    expect(toolsApi.createTool).not.toHaveBeenCalled()
    expect(toolsApi.updateTool).toHaveBeenCalledWith('tool_orphan', desired('sec_1'))
    expect(toolsApi.listTools).toHaveBeenCalledWith(expect.objectContaining({ search: 'transfer_to_human', types: ['webhook'] }))
  })

  it('concurrent first uses create the tool once (lease row); the others wait for it', async () => {
    seed([{ key: S, provider: 'elevenlabs', external_id: 'sec_1', details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } }])
    vi.mocked(toolsApi.createTool).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return { id: 'tool_1', tool_config: {} }
    })
    const results = await Promise.all([ensurePlatformTool(T, { verify: 'cached' }), ensurePlatformTool(T, { verify: 'cached' })])
    expect(toolsApi.createTool).toHaveBeenCalledTimes(1)
    expect(results.map((r) => r.toolId)).toEqual(['tool_1', 'tool_1'])
    expect(results.map((r) => r.action).sort()).toEqual(['created', 'waited'])
  })

  it('a lost lease (another creator finished first) deletes the duplicate we created and keeps theirs', async () => {
    seed([{ key: S, provider: 'elevenlabs', external_id: 'sec_1', details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } }])
    vi.mocked(toolsApi.createTool).mockImplementation(async () => {
      // Meanwhile our lease expired and another instance completed its creation.
      Object.assign(row(T)!, { external_id: 'tool_winner', status: 'ready', lease_owner: null, lease_until: null })
      return { id: 'tool_dup', tool_config: {} }
    })
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_winner', action: 'waited' })
    expect(toolsApi.deleteTool).toHaveBeenCalledWith('tool_dup', { force: false })
    expect(row(T)).toMatchObject({ external_id: 'tool_winner', status: 'ready' })
  })

  it('takes over an expired lease (crashed creator) and releases its own lease when the creation fails', async () => {
    seed([
      { key: S, provider: 'elevenlabs', external_id: 'sec_1', details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } },
      { key: T, provider: 'elevenlabs', external_id: '', status: 'creating', lease_owner: 'crashed', lease_until: new Date(Date.now() - 1000).toISOString() },
    ])
    vi.mocked(toolsApi.createTool).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'tools.create' }))
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'upstream' })
    expect(row(T)).toBeUndefined() // released: the next attempt can claim at once
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1', action: 'created' })
  })

  it('a live lease held elsewhere is never taken over: it waits, then fails without creating', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    seed([
      { key: S, provider: 'elevenlabs', external_id: 'sec_1', details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } },
      { key: T, provider: 'elevenlabs', external_id: '', status: 'creating', lease_owner: 'other', lease_until: new Date(Date.now() + 60_000).toISOString() },
    ])
    const p = ensurePlatformTool(T, { verify: 'cached' })
    const assertion = expect(p).rejects.toMatchObject({ code: 'conflict' })
    await vi.advanceTimersByTimeAsync(7_000)
    await assertion
    expect(toolsApi.createTool).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('reconcile: PATCH on drift, recreate on 404', () => {
  const ready = (details: Record<string, unknown> = {}) =>
    seed([
      { key: S, provider: 'elevenlabs', external_id: 'sec_1', details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } },
      { key: T, provider: 'elevenlabs', external_id: 'tool_1', details: { config_hash: toolConfigHash(desired()), auth: 'headers', ...details } },
    ])

  it('PATCHes the full config when the stored hash differs (legacy tool, new base URL), then records the new hash', async () => {
    ready({ config_hash: 'legacy', auth: undefined })
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1', action: 'patched' })
    expect(toolsApi.updateTool).toHaveBeenCalledWith('tool_1', desired())
    expect(row(T)!.details).toMatchObject({ config_hash: toolConfigHash(desired()), auth: 'headers' })

    vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://new.example.com')
    resetPlatformToolMemo()
    await ensurePlatformTool(T, { verify: 'cached' })
    expect(vi.mocked(toolsApi.updateTool).mock.calls.at(-1)?.[1]).toMatchObject({ api_schema: { url: 'https://new.example.com/api/telephony/tools/transfer' } })
  })

  it('recreates a tool deleted in the dashboard (GET 404) and forgets only that id', async () => {
    ready()
    vi.mocked(toolsApi.getTool).mockRejectedValueOnce(notFound('tools.get'))
    vi.mocked(toolsApi.createTool).mockResolvedValue({ id: 'tool_2', tool_config: {} })
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toEqual({ key: T, toolId: 'tool_2', action: 'recreated' })
    expect(row(T)).toMatchObject({ external_id: 'tool_2', status: 'ready' })
  })

  it('a PATCH answered 404 also recreates', async () => {
    ready({ config_hash: 'old' })
    vi.mocked(toolsApi.updateTool).mockRejectedValueOnce(notFound('tools.update'))
    vi.mocked(toolsApi.createTool).mockResolvedValue({ id: 'tool_3', tool_config: {} })
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_3', action: 'recreated' })
  })

  it('a transient failure keeps the existing tool (reconciled next time); a non-transient one is thrown', async () => {
    ready()
    vi.mocked(toolsApi.getTool).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'timeout', operation: 'tools.get' }))
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1', action: 'unverified' })
    // An older config (legacy tool) still served calls: kept, PATCH deferred.
    ready({ config_hash: 'old' })
    resetPlatformToolMemo()
    vi.mocked(toolsApi.getTool).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'tools.get' }))
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1', action: 'unverified' })
    vi.mocked(toolsApi.updateTool).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'rate_limited', operation: 'tools.update' }))
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1', action: 'unverified' })
    expect(row(T)!.details).toMatchObject({ config_hash: 'old' }) // not recorded: the next ensure PATCHes again
    // Our config rejected, or credentials refused: thrown (the agent sync is then degraded).
    vi.mocked(toolsApi.updateTool).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'tools.update' }))
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'validation' })
    vi.mocked(toolsApi.getTool).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'auth', operation: 'tools.get' }))
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'auth' })
  })

  it('a transient secret failure keeps the existing tool; without any tool it is thrown', async () => {
    seed([{ key: T, provider: 'elevenlabs', external_id: 'tool_legacy', details: {} }])
    vi.mocked(secretsApi.listSecrets).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'network', operation: 'secrets.list' }))
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_legacy', action: 'unverified' })
    seed()
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'network' })
    expect(toolsApi.createTool).not.toHaveBeenCalled()
  })

  it('maintenance (verify always) also reverts dashboard edits of fields we own', async () => {
    ready()
    vi.mocked(toolsApi.getTool).mockResolvedValueOnce({ id: 'tool_1', tool_config: { ...desired(), execution_mode: 'immediate' } })
    expect(await ensurePlatformTool(T, { verify: 'always' })).toMatchObject({ action: 'patched' })
    vi.mocked(toolsApi.updateTool).mockClear()
    expect(await ensurePlatformTool(T, { verify: 'always' })).toMatchObject({ action: 'verified' })
    expect(toolsApi.updateTool).not.toHaveBeenCalled()
    expect(row(T)!.checked_at).toEqual(expect.any(String))
  })

  it('an operator-pinned tool is validated and reconciled but never recreated', async () => {
    vi.stubEnv('ELEVENLABS_TRANSFER_TOOL_ID', 'tool_pinned')
    ready()
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_pinned', action: 'patched' })
    expect(toolsApi.updateTool).toHaveBeenCalledWith('tool_pinned', desired())
    expect(row(T)).toMatchObject({ external_id: 'tool_pinned', details: { config_hash: toolConfigHash(desired()) } })
    resetPlatformToolMemo()
    vi.mocked(toolsApi.getTool).mockRejectedValueOnce(notFound('tools.get'))
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'not_found' })
    expect(toolsApi.createTool).not.toHaveBeenCalled()
  })

  it('remoteToolDrift compares only the fields we own (null and missing are equal)', () => {
    const d = desired()
    expect(remoteToolDrift({ ...d, tool_call_sound: undefined, usage: 1 }, d)).toEqual([])
    expect(remoteToolDrift({ ...d, api_schema: { ...d.api_schema, url: 'https://evil.example.com/x' } }, d)).toEqual(['api_schema.url'])
    expect(remoteToolDrift(null, d)).toContain('name')
  })
})

describe('workspace secret', () => {
  it('rotates in place when ELEVENLABS_TOOL_SECRET changed (same id, no tool PATCH needed)', async () => {
    seed([
      { key: S, provider: 'elevenlabs', external_id: 'sec_1', details: { name: 'ntv_tool_key_old', value_fp: secretFingerprint(KEY) } },
      { key: T, provider: 'elevenlabs', external_id: 'tool_1', details: { config_hash: toolConfigHash(desired()), auth: 'headers' } },
    ])
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', KEY_2)
    expect(await ensureToolSecret({ verify: 'cached' })).toBe('sec_1')
    expect(secretsApi.updateSecret).toHaveBeenCalledWith('sec_1', { name: 'ntv_tool_key_old', value: KEY_2 })
    expect(row(S)!.details).toMatchObject({ value_fp: secretFingerprint(KEY_2), rotated_at: expect.any(String) })
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1' })
    expect(toolsApi.updateTool).not.toHaveBeenCalled()
  })

  it('maintenance recreates a secret deleted in the dashboard', async () => {
    seed([{ key: S, provider: 'elevenlabs', external_id: 'sec_gone', details: { name: toolSecretName(BASE), value_fp: secretFingerprint(KEY) } }])
    vi.mocked(secretsApi.getSecret).mockRejectedValueOnce(notFound('secrets.get'))
    vi.mocked(secretsApi.createSecret).mockResolvedValue({ secret_id: 'sec_2', name: 'n' })
    expect(await ensureToolSecret({ verify: 'always' })).toBe('sec_2')
    expect(row(S)).toMatchObject({ external_id: 'sec_2' })
  })

  it('adopts this deployment\'s secret by exact name and sets its value', async () => {
    vi.mocked(secretsApi.listSecrets).mockResolvedValue({ secrets: [{ secret_id: 'sec_prefix', name: `${toolSecretName(BASE)}_x` }, { secret_id: 'sec_mine', name: toolSecretName(BASE) }] })
    expect(await ensureToolSecret({ verify: 'cached' })).toBe('sec_mine')
    expect(secretsApi.updateSecret).toHaveBeenCalledWith('sec_mine', { name: toolSecretName(BASE), value: KEY })
    expect(secretsApi.createSecret).not.toHaveBeenCalled()
  })

  it('the secret name is per environment and per public host, so one workspace can serve several deployments', () => {
    expect(toolSecretName(BASE)).toMatch(/^ntv_tool_key_[a-z0-9]+_[0-9a-f]{8}$/)
    expect(toolSecretName('https://other.example.com')).not.toBe(toolSecretName(BASE))
  })

  it('production without ELEVENLABS_TOOL_SECRET: no tool can be set up (thrown, never swallowed); elsewhere the tool has no key header', async () => {
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', '')
    expect(await ensurePlatformTool(T, { verify: 'cached' })).toMatchObject({ toolId: 'tool_1' })
    expect(toolsApi.createTool).toHaveBeenCalledWith(desired(null))
    vi.stubEnv('NODE_ENV', 'production')
    resetPlatformToolMemo()
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'not_configured' })
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', 'too-short')
    await expect(ensureToolSecret({ verify: 'cached' })).rejects.toMatchObject({ code: 'not_configured' })
  })

  it('without a public base URL nothing is created', async () => {
    vi.stubEnv('VOICE_PUBLIC_BASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    await expect(ensurePlatformTool(T, { verify: 'cached' })).rejects.toMatchObject({ code: 'not_configured' })
    expect(toolsApi.createTool).not.toHaveBeenCalled()
    expect(secretsApi.createSecret).not.toHaveBeenCalled()
  })
})

describe('read-only id and reconcile report', () => {
  it('storedPlatformToolId never calls the provider and ignores a creation in progress', async () => {
    seed([{ key: T, provider: 'elevenlabs', external_id: '', status: 'creating', lease_owner: 'x', lease_until: new Date(Date.now() + 60_000).toISOString() }])
    expect(await storedPlatformToolId(T)).toBeNull()
    seed([{ key: T, provider: 'elevenlabs', external_id: 'tool_1' }])
    expect(await storedPlatformToolId(T)).toBe('tool_1')
    vi.stubEnv('ELEVENLABS_TRANSFER_TOOL_ID', 'tool_pinned')
    expect(await storedPlatformToolId(T)).toBe('tool_pinned')
    expect(toolsApi.getTool).not.toHaveBeenCalled()
    expect(toolsApi.createTool).not.toHaveBeenCalled()
  })

  it('reconcilePlatformTools reports per resource and never throws', async () => {
    const first = await reconcilePlatformTools()
    expect(first).toMatchObject({ configured: true, secret: { status: 'ok' } })
    expect(first.tools[0]).toEqual({ key: T, status: 'ok', toolId: 'tool_1', action: 'created' })
    // Every platform tool is reconciled (slice B2 added the in-call business tools).
    expect(first.tools.map((t) => t.key)).toEqual(PLATFORM_TOOL_KEYS)
    expect(first.tools.every((t) => t.status === 'ok')).toBe(true)
    resetPlatformToolMemo()
    vi.mocked(toolsApi.getTool).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'auth', operation: 'tools.get' }))
    vi.mocked(secretsApi.getSecret).mockResolvedValue({ secret_id: 'sec_1', name: 'n' })
    const report = await reconcilePlatformTools()
    expect(report.secret).toEqual({ status: 'ok' })
    expect(report.tools[0]).toMatchObject({ key: T, status: 'error', code: 'auth', message: expect.any(String) })
  })
})
