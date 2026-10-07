import 'server-only'
// Custom voices (instant clones and designed voices) share ONE ElevenLabs
// workspace, so one tenant could exhaust the voice slots of every tenant.
// Three gates run before any provider call that creates a custom voice:
//   1. plan: only plans whose entitlements include voice cloning
//      (lib/pages/entitlements.ts: pro, business, custom; not trial/starter);
//   2. a cap of active custom voices per organization
//      (ELEVENLABS_MAX_CLONES_PER_ORG, default 2), re-checked after the
//      registry insert so two concurrent requests cannot both pass it;
//   3. the workspace quota (GET /v1/user/subscription, cached 60 s): voice
//      slots, add/edit operations, instant cloning availability. Exhausted
//      quota answers 503 voice_capacity and alerts ops; an unreadable quota
//      fails open (the provider still rejects, mapped to the same 503).

import type { SupabaseClient } from '@supabase/supabase-js'
import { RequestError } from '@/lib/api/http'
import { getVoiceQuota, type ELVoiceQuota } from '@/lib/elevenlabs/api/voices'
import { entitlementsFor, requiredPlanFor } from '@/lib/pages/entitlements'
import type { Logger } from '@/lib/observability/logger'
import type { Plan } from '@/types'
import { isProviderError } from './errors'

export const VOICE_CAPACITY_MESSAGE = 'New voices cannot be added on the platform right now. Please try again later or choose a voice you already have.'

/** The shared workspace cannot hold another custom voice (or the provider refused for quota reasons). */
export class VoiceCapacityError extends Error {
  constructor(readonly reason: string) {
    super(VOICE_CAPACITY_MESSAGE)
    this.name = 'VoiceCapacityError'
  }
}

const DEFAULT_MAX_CUSTOM_VOICES = 2

/** ELEVENLABS_MAX_CLONES_PER_ORG (default 2, 0–50): cloned + designed voices an organization may keep. */
export function maxCustomVoicesPerOrg(): number {
  const raw = (process.env.ELEVENLABS_MAX_CLONES_PER_ORG ?? '').trim()
  if (!raw) return DEFAULT_MAX_CUSTOM_VOICES
  const v = Number(raw)
  return Number.isInteger(v) && v >= 0 && v <= 50 ? v : DEFAULT_MAX_CUSTOM_VOICES
}

const PLANS: readonly Plan[] = ['trial', 'starter', 'pro', 'business', 'custom']

function asPlan(raw: string | null | undefined): Plan {
  return PLANS.includes(raw as Plan) ? (raw as Plan) : 'trial'
}

/** Whether the organization's plan includes custom voices (unknown plans get trial rights, never more). */
export function customVoicesAllowed(plan: string | null | undefined): boolean {
  return entitlementsFor(asPlan(plan)).voiceCloning
}

export function requiredPlanForCustomVoices(): Plan {
  return requiredPlanFor('voiceCloning')
}

export function assertCustomVoicePlan(plan: string | null | undefined): void {
  if (customVoicesAllowed(plan)) return
  const required = requiredPlanForCustomVoices()
  const name = required.charAt(0).toUpperCase() + required.slice(1)
  throw new RequestError('forbidden', `Custom voices are available on the ${name} plan and above.`, 403, {
    reason: 'plan',
    required_plan: required,
  })
}

const ACTIVE_STATUSES = ['ready', 'pending']

async function activeCustomVoices(db: SupabaseClient, orgId: string): Promise<Array<{ id: string; voice_id: string; created_at: string }>> {
  const { data, error } = await db
    .from('provider_voices')
    .select('id, voice_id, created_at')
    .eq('provider', 'elevenlabs')
    .eq('owner_org_id', orgId)
    .in('source', ['cloned', 'designed'])
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  return (data ?? []) as Array<{ id: string; voice_id: string; created_at: string }>
}

export async function countCustomVoices(db: SupabaseClient, orgId: string): Promise<number> {
  return (await activeCustomVoices(db, orgId)).length
}

function capError(limit: number): RequestError {
  return new RequestError(
    'conflict',
    limit === 0
      ? 'Custom voices are not available for your account.'
      : `You can keep up to ${limit} custom voice${limit === 1 ? '' : 's'}. Delete one to create another.`,
    409,
    { reason: 'custom_voice_limit', limit },
  )
}

/** 409 when the organization already has the maximum number of custom voices. */
export async function assertCustomVoiceCap(db: SupabaseClient, orgId: string): Promise<void> {
  const limit = maxCustomVoicesPerOrg()
  if ((await countCustomVoices(db, orgId)) >= limit) throw capError(limit)
}

/**
 * Re-check after the registry insert: the oldest `limit` custom voices win, so
 * of two concurrent requests that both passed assertCustomVoiceCap only the
 * later one is over the cap. Returns the 409 to throw (after the caller's
 * compensating delete) or null when the voice is within the cap.
 */
export async function capViolationAfterInsert(db: SupabaseClient, orgId: string, voiceId: string): Promise<RequestError | null> {
  const limit = maxCustomVoicesPerOrg()
  const rows = await activeCustomVoices(db, orgId)
  const position = rows.findIndex((r) => r.voice_id === voiceId)
  return position >= limit ? capError(limit) : null
}

// ─── Workspace quota ─────────────────────────────────────────────────────────

const QUOTA_TTL_MS = 60_000
let quotaCache: { at: number; quota: ELVoiceQuota } | null = null

/** For tests. */
export function resetVoiceQuotaCache(): void {
  quotaCache = null
}

async function readQuota(): Promise<ELVoiceQuota> {
  if (quotaCache && Date.now() - quotaCache.at < QUOTA_TTL_MS) return quotaCache.quota
  const quota = await getVoiceQuota()
  quotaCache = { at: Date.now(), quota }
  return quota
}

/** Why the workspace cannot take another voice of this kind, or null. Pure. */
export function quotaBlocker(quota: ELVoiceQuota, kind: 'clone' | 'design' | 'library'): string | null {
  if (kind === 'clone' && quota.can_use_instant_voice_cloning === false) return 'ivc_unavailable'
  // Library copies do not use custom voice slots (Voice Library docs); clones and designed voices do.
  if (kind !== 'library' && typeof quota.voice_limit === 'number' && typeof quota.voice_slots_used === 'number' && quota.voice_slots_used >= quota.voice_limit) {
    return 'voice_slots_full'
  }
  if (typeof quota.max_voice_add_edits === 'number' && typeof quota.voice_add_edit_counter === 'number' && quota.voice_add_edit_counter >= quota.max_voice_add_edits) {
    return 'voice_add_edit_limit'
  }
  return null
}

/**
 * Preflight against the workspace quota. Throws VoiceCapacityError (503
 * voice_capacity for the tenant, an error log for ops) when the workspace is
 * full; never shows the tenant the platform's numbers.
 */
export async function assertWorkspaceVoiceCapacity(kind: 'clone' | 'design' | 'library', log: Logger): Promise<void> {
  let quota: ELVoiceQuota
  try {
    quota = await readQuota()
  } catch (err) {
    // A key without the user scope cannot read the subscription: the provider
    // still enforces its limits (mapped to the same 503 by isVoiceCapacityProviderError).
    log.warn('voice_capacity.quota_unavailable', { kind, error: isProviderError(err) ? err.code : 'unknown' })
    return
  }
  const blocker = quotaBlocker(quota, kind)
  if (!blocker) return
  log.error('voice_capacity.exhausted', null, {
    kind,
    reason: blocker,
    voiceSlotsUsed: quota.voice_slots_used ?? null,
    voiceLimit: quota.voice_limit ?? null,
    addEditCounter: quota.voice_add_edit_counter ?? null,
    maxAddEdits: quota.max_voice_add_edits ?? null,
  })
  throw new VoiceCapacityError(blocker)
}

/**
 * Provider refusals that mean "the workspace is full" rather than "this
 * request is invalid": the detail.status of the error body (kept by
 * ProviderError.detail), or a 402/quota code.
 */
export function isVoiceCapacityProviderError(err: unknown): boolean {
  // Only operations that add a voice to the workspace: a quota error on a
  // preview (character credits) keeps its own message.
  if (!isProviderError(err) || !VOICE_ADDING_OPERATIONS.has(err.operation)) return false
  if (err.code === 'quota') return true
  const detail = err.detail ?? ''
  return /voice_limit|voice_add_edit|limit_reached|too_many_voices|maximum (number of )?voices|voice slots?/i.test(detail)
}

const VOICE_ADDING_OPERATIONS = new Set(['shared_voices.add', 'voices.ivc', 'voices.create_from_preview'])
