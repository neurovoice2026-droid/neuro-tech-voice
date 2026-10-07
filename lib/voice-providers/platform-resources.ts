import 'server-only'
// Platform-level provider resources shared by every organization, created on
// first use and remembered in `platform_resources` (service role only):
//   elevenlabs.transfer_tool   webhook tool → /api/telephony/tools/transfer
//   elevenlabs.tool_secret     workspace secret behind the X-NTV-Tool-Key header
//   elevenlabs.tool.*          in-call business tools (check_availability, book_appointment, take_message)
//   cartesia.message_tool      webhook tool → /api/telephony/tools/cartesia-message (fallback take_message)
//   cartesia.sip_provider      SIP trunk provider our Twilio ingress dials into
//   cartesia.call_webhook      call-event webhook → /api/cartesia/webhook
//   cartesia.context_tool      webhook tool → /api/telephony/tools/cartesia-context
// An env var with the external id takes precedence (pre-provisioned setups).
//
// The ElevenLabs tools and secret are created race-safely and reconciled by
// ./platform-tools.ts (lease rows, migration 016): a row with status
// 'creating' (external_id '') is a creation in progress, never an id.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/observability/logger'
import { publicBaseUrl, cartesiaSip } from './config'
import { ProviderError, isProviderError } from './errors'
import * as cartesia from '@/lib/cartesia/client'
import { contextToolDefinition, messageToolDefinition } from '@/lib/cartesia/agent-config'
import { isPlatformToolKey } from '@/lib/elevenlabs/tools/definitions'

const log = createLogger({ component: 'platform_resources' })

export type PlatformResourceKey =
  | 'elevenlabs.transfer_tool'
  | 'elevenlabs.tool_secret'
  | 'elevenlabs.tool.check_availability'
  | 'elevenlabs.tool.book_appointment'
  | 'elevenlabs.tool.take_message'
  | 'cartesia.sip_provider'
  | 'cartesia.call_webhook'
  | 'cartesia.context_tool'
  | 'cartesia.message_tool'

const ALL_KEYS: PlatformResourceKey[] = [
  'elevenlabs.transfer_tool',
  'elevenlabs.tool_secret',
  'elevenlabs.tool.check_availability',
  'elevenlabs.tool.book_appointment',
  'elevenlabs.tool.take_message',
  'cartesia.sip_provider',
  'cartesia.call_webhook',
  'cartesia.context_tool',
  'cartesia.message_tool',
]

const ENV_OVERRIDE: Partial<Record<PlatformResourceKey, string>> = {
  'elevenlabs.transfer_tool': 'ELEVENLABS_TRANSFER_TOOL_ID',
  'cartesia.sip_provider': 'CARTESIA_SIP_PROVIDER_ID',
  'cartesia.call_webhook': 'CARTESIA_WEBHOOK_ID',
  'cartesia.context_tool': 'CARTESIA_CONTEXT_TOOL_ID',
}

/** Operator-pinned external id (env), or null. */
export function pinnedResourceId(key: PlatformResourceKey): string | null {
  const name = ENV_OVERRIDE[key]
  return name ? (process.env[name] ?? '').trim() || null : null
}

/** Per-instance cache of ready ids; short-lived so a forget/recreate elsewhere is picked up. */
const MEMO_TTL_MS = 5 * 60_000
const memo = new Map<PlatformResourceKey, { id: string; at: number }>()

async function read(key: PlatformResourceKey): Promise<string | null> {
  const env = pinnedResourceId(key)
  if (env) return env
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.id
  const { data, error } = await createAdminClient().from('platform_resources').select('external_id').eq('key', key).maybeSingle()
  if (error) throw new Error(`platform_resources read failed: ${error.message}`)
  // '' = a creation in progress (lease row), not an id.
  const id = (data?.external_id as string | undefined) || null
  if (id) memo.set(key, { id, at: Date.now() })
  else memo.delete(key)
  return id
}

async function remember(key: PlatformResourceKey, provider: string, externalId: string, details: Record<string, unknown> = {}) {
  const { error } = await createAdminClient()
    .from('platform_resources')
    .upsert({ key, provider, external_id: externalId, details, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`platform_resources write failed: ${error.message}`)
  memo.set(key, { id: externalId, at: Date.now() })
}

function requireBase(operation: string, system: 'elevenlabs' | 'cartesia'): string {
  const base = publicBaseUrl()
  if (!base) throw new ProviderError({ system, operation, code: 'not_configured', detail: 'VOICE_PUBLIC_BASE_URL missing' })
  return base
}

/** Returns the id of the resource, creating it once if needed. Returns null when its prerequisites are missing. */
export async function ensurePlatformResource(key: PlatformResourceKey): Promise<string | null> {
  if (key === 'elevenlabs.tool_secret' || isPlatformToolKey(key)) {
    // Reconciled (config hash, 404 recreate, lease) by platform-tools.ts.
    const tools = await import('./platform-tools')
    try {
      return key !== 'elevenlabs.tool_secret'
        ? (await tools.ensurePlatformTool(key, { verify: 'cached' })).toolId
        : await tools.ensureToolSecret({ verify: 'cached' })
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_configured') return null
      throw err
    }
  }

  const existing = await read(key)
  if (existing) return existing

  switch (key) {
    case 'cartesia.sip_provider': {
      const sip = cartesiaSip()
      if (!cartesia.isConfigured() || !sip.username || !sip.password) return null
      const created = await cartesia.telephony.createSipProvider({
        label: 'neuro-tech-voice twilio ingress',
        inbound: { credentials: { username: sip.username, password: sip.password }, media_encryption: 'allowed' },
      })
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
    case 'cartesia.call_webhook': {
      const secret = (process.env.CARTESIA_WEBHOOK_SECRET ?? '').trim()
      if (!cartesia.isConfigured() || secret.length < 24) return null
      const base = requireBase('webhooks.create', 'cartesia')
      const created = await cartesia.webhooks.create({ url: `${base}/api/cartesia/webhook`, secret, display_name: 'neuro-tech-voice call events' })
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
    case 'cartesia.context_tool': {
      const toolSecret = (process.env.CARTESIA_TOOL_SECRET ?? '').trim()
      if (!cartesia.isConfigured() || toolSecret.length < 24) return null
      const base = requireBase('tools.create', 'cartesia')
      const created = await cartesia.tools.create(contextToolDefinition(`${base}/api/telephony/tools/cartesia-context`, toolSecret))
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
    case 'cartesia.message_tool': {
      const toolSecret = (process.env.CARTESIA_TOOL_SECRET ?? '').trim()
      if (!cartesia.isConfigured() || toolSecret.length < 24) return null
      const base = requireBase('tools.create', 'cartesia')
      const created = await cartesia.tools.create(messageToolDefinition(`${base}/api/telephony/tools/cartesia-message`, toolSecret))
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
    default:
      return null
  }
}

/** Same as ensurePlatformResource but never throws (logs and returns null). */
export async function tryPlatformResource(key: PlatformResourceKey): Promise<string | null> {
  try {
    return await ensurePlatformResource(key)
  } catch (err) {
    log.error('platform_resource.ensure_failed', err, { key })
    return null
  }
}

/** For diagnostics: which platform resources exist (ids only). */
export async function listPlatformResources(): Promise<Record<PlatformResourceKey, string | null>> {
  const out = {} as Record<PlatformResourceKey, string | null>
  for (const k of ALL_KEYS) {
    try {
      out[k] = await read(k)
    } catch (err) {
      log.error('platform_resource.read_failed', err, { key: k })
      out[k] = null
    }
  }
  return out
}

/**
 * Drops a stored resource id that the provider says no longer exists, so the
 * next ensurePlatformResource() recreates it. With `externalId`, only that id
 * is forgotten (a newer id written meanwhile by another instance is kept).
 * Env-pinned ids are left alone (the operator owns them); failures are
 * logged, never thrown.
 */
export async function forgetPlatformResource(key: PlatformResourceKey, externalId?: string): Promise<void> {
  memo.delete(key)
  if (pinnedResourceId(key)) {
    log.warn('platform_resource.pinned_missing', { key })
    return
  }
  let q = createAdminClient().from('platform_resources').delete().eq('key', key)
  if (externalId) q = q.eq('external_id', externalId)
  const { error } = await q
  if (error) log.error('platform_resource.forget_failed', error, { key })
  else log.warn('platform_resource.forgotten', { key })
}

/** Test helper: forget the per-instance id cache. */
export function resetPlatformResourceMemo(): void {
  memo.clear()
}

// ─── Lease rows (race-safe creation; columns from migration 016) ─────────────

export interface PlatformResourceRow {
  key: string
  provider: string
  /** '' while status is 'creating'. */
  external_id: string
  /** Absent before migration 016 (then every row with an id is ready). */
  status?: 'creating' | 'ready' | null
  details: Record<string, unknown>
  lease_owner?: string | null
  lease_until?: string | null
  checked_at?: string | null
  monitor?: Record<string, unknown> | null
}

/** The stored row (select *, so it also works before migration 016), or null. */
export async function readResourceRow(key: PlatformResourceKey): Promise<PlatformResourceRow | null> {
  const { data, error } = await createAdminClient().from('platform_resources').select('*').eq('key', key).maybeSingle()
  if (error) throw new Error(`platform_resources read failed: ${error.message}`)
  if (!data) return null
  const row = data as PlatformResourceRow
  return { ...row, details: (row.details as Record<string, unknown> | null) ?? {} }
}

/** A row that holds a usable id. */
export function isReadyRow(row: PlatformResourceRow | null): row is PlatformResourceRow {
  return !!row && !!row.external_id && (row.status ?? 'ready') === 'ready'
}

/**
 * Claims the right to create `key`: inserts a 'creating' lease row when none
 * exists, or takes over a creation whose lease expired (its owner crashed).
 * Exactly one caller gets true; the others wait for the row to become ready.
 */
export async function claimResourceLease(key: PlatformResourceKey, provider: string, owner: string, leaseMs: number, now = Date.now()): Promise<boolean> {
  const db = createAdminClient()
  const until = new Date(now + leaseMs).toISOString()
  const { data, error } = await db
    .from('platform_resources')
    .upsert(
      { key, provider, external_id: '', status: 'creating', lease_owner: owner, lease_until: until, details: {}, updated_at: new Date(now).toISOString() },
      { onConflict: 'key', ignoreDuplicates: true },
    )
    .select('key')
  if (error) throw new Error(`platform_resources lease insert failed: ${error.message}`)
  if (data && data.length > 0) return true
  const { data: took, error: takeErr } = await db
    .from('platform_resources')
    .update({ lease_owner: owner, lease_until: until, updated_at: new Date(now).toISOString() })
    .eq('key', key)
    .eq('status', 'creating')
    .lt('lease_until', new Date(now).toISOString())
    .select('key')
  if (takeErr) throw new Error(`platform_resources lease takeover failed: ${takeErr.message}`)
  return !!took && took.length > 0
}

/** Turns our lease row into the ready resource. False when the lease was lost (another creator finished first). */
export async function completeResourceLease(key: PlatformResourceKey, owner: string, externalId: string, details: Record<string, unknown>): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from('platform_resources')
    .update({ external_id: externalId, status: 'ready', lease_owner: null, lease_until: null, details, updated_at: now, checked_at: now })
    .eq('key', key)
    .eq('status', 'creating')
    .eq('lease_owner', owner)
    .select('key')
  if (error) throw new Error(`platform_resources lease completion failed: ${error.message}`)
  const won = !!data && data.length > 0
  if (won) memo.set(key, { id: externalId, at: Date.now() })
  return won
}

/** Gives a failed creation back (only our own, still-creating lease row is removed). Logged, never thrown. */
export async function releaseResourceLease(key: PlatformResourceKey, owner: string): Promise<void> {
  const { error } = await createAdminClient().from('platform_resources').delete().eq('key', key).eq('status', 'creating').eq('lease_owner', owner)
  if (error) log.error('platform_resource.lease_release_failed', error, { key })
}

/** Replaces details of the ready row holding `externalId` (config hash after a PATCH, secret fingerprint after a rotation). */
export async function updateResourceDetails(key: PlatformResourceKey, externalId: string, details: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient()
    .from('platform_resources')
    .update({ details, updated_at: new Date().toISOString() })
    .eq('key', key)
    .eq('external_id', externalId)
  if (error) throw new Error(`platform_resources details write failed: ${error.message}`)
}

/** Stores (or replaces) the row of an operator-pinned id, so its config hash is remembered. */
export async function rememberPinnedResource(key: PlatformResourceKey, provider: string, externalId: string, details: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await createAdminClient()
    .from('platform_resources')
    .upsert(
      { key, provider, external_id: externalId, status: 'ready', lease_owner: null, lease_until: null, details, updated_at: now, checked_at: now },
      { onConflict: 'key' },
    )
  if (error) throw new Error(`platform_resources write failed: ${error.message}`)
}

/** Last successful remote verification (best effort: logged, never thrown). */
export async function touchResourceChecked(key: PlatformResourceKey, externalId: string): Promise<void> {
  const { error } = await createAdminClient().from('platform_resources').update({ checked_at: new Date().toISOString() }).eq('key', key).eq('external_id', externalId)
  if (error) log.error('platform_resource.checked_write_failed', error, { key })
}

/** Monitoring summary (counts and timestamps only), shown by the admin diagnostics. Logged, never thrown. */
export async function writeResourceMonitor(key: PlatformResourceKey, monitor: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient().from('platform_resources').update({ monitor }).eq('key', key).neq('external_id', '')
  if (error) log.error('platform_resource.monitor_write_failed', error, { key })
}
