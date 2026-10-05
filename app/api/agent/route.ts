// GET   /api/agent → Agent (find-or-create the org's single agent)
// PATCH /api/agent → { agent, sync } — saves the change, then pushes it to the
// primary provider (awaited) and the fallback provider (after the response).
// A provider sync failure is reported in `sync`, not as an HTTP error: the
// change is saved and the sync engine/maintenance job retries it.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import {
  AGENT_NAME_MAX,
  AgentLanguageSchema,
  FALLBACK_MESSAGE_MAX,
  FIRST_MESSAGE_MAX,
  PersonalitySchema,
  SYSTEM_PROMPT_MAX,
  blankToNull,
  defaultAgentName,
  ensureAgent,
  hasExternalAgent,
  mergeMetadata,
  syncAgentProviders,
  type AgentSyncReport,
} from '@/lib/agents/ensure-agent'
import {
  AfterHoursSchema,
  AnalysisSettingsSchema,
  ConversationSettingsSchema,
  DynamicVariablesSchema,
  PrivacySettingsSchema,
  TransferSettingsSchema,
  VoiceTuningSchema,
  WorkingHoursSchema,
} from '@/lib/voice-providers/settings'
import type { VoiceProvider } from '@/lib/voice-providers/errors'
import * as cartesia from '@/lib/cartesia/client'
import { getAllowedFallbackVoice } from '@/lib/voice-providers/voice-catalog'
import { isValidTimeZone } from '@/lib/scheduling/time'
import type { Agent } from '@/types'

// The awaited primary sync can take several provider round-trips.
export const maxDuration = 60

const PatchAgentSchema = z.strictObject({
  name: z.string().trim().min(1).max(AGENT_NAME_MAX).optional(),
  language: AgentLanguageSchema.optional(),
  system_prompt: z.string().max(SYSTEM_PROMPT_MAX).nullable().optional(),
  first_message: z.string().max(FIRST_MESSAGE_MAX).nullable().optional(),
  fallback_message: z.string().max(FALLBACK_MESSAGE_MAX).nullable().optional(),
  is_active: z.boolean().optional(),
  working_hours: WorkingHoursSchema.optional(),
  metadata: z.strictObject({ personality: PersonalitySchema }).optional(),
  conversation_settings: ConversationSettingsSchema.optional(),
  after_hours: AfterHoursSchema.optional(),
  transfer_settings: TransferSettingsSchema.optional(),
  analysis_settings: AnalysisSettingsSchema.optional(),
  privacy_settings: PrivacySettingsSchema.optional(),
  voice_settings: VoiceTuningSchema.optional(),
  dynamic_variables: DynamicVariablesSchema.optional(),
  // Cartesia voice for the fallback agent; null = automatic per language.
  fallback_voice_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Invalid voice id')
    .nullable()
    .optional(),
  organization: z
    .strictObject({
      timezone: z.string().trim().min(1).max(64).refine((tz) => isValidTimeZone(tz), 'Unknown time zone').optional(),
      voice_fallback_enabled: z.boolean().optional(),
    })
    .optional(),
})

type PatchAgentBody = z.infer<typeof PatchAgentSchema>

/** Fields that end up in the provider-side agent (AgentSpec). */
const PROVIDER_FIELDS = [
  'name',
  'language',
  'system_prompt',
  'first_message',
  'fallback_message',
  'conversation_settings',
  'transfer_settings',
  'analysis_settings',
  'privacy_settings',
  'voice_settings',
  'dynamic_variables',
  'fallback_voice_id',
] as const satisfies ReadonlyArray<keyof PatchAgentBody & keyof Agent>

/** Fields only our own router/UI read (no provider push needed). */
const LOCAL_FIELDS = ['is_active', 'working_hours', 'after_hours'] as const satisfies ReadonlyArray<
  keyof PatchAgentBody & keyof Agent
>

const TEXT_FIELDS = new Set<string>(['system_prompt', 'first_message', 'fallback_message'])

/** JSON with sorted object keys, so JSONB key order never counts as a change. */
function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

function primaryProviderOf(agent: Agent): VoiceProvider {
  return agent.primary_provider === 'cartesia' ? 'cartesia' : 'elevenlabs'
}

/**
 * A fallback voice must be one the voice catalog offers this tenant (active
 * public Cartesia voice or a platform-mapped one; never another account's
 * private voice) — same rule as GET /api/voices/fallback. Without Cartesia
 * configured the id is format-checked only; the sync engine validates it
 * again before use.
 */
async function assertFallbackVoiceEligible(voiceId: string, log: Logger): Promise<void> {
  if (!cartesia.isConfigured()) {
    log.info('agent.fallback_voice_unverified', { reason: 'cartesia_not_configured' })
    return
  }
  try {
    await getAllowedFallbackVoice(voiceId)
  } catch (err) {
    if (err instanceof RequestError && (err.status === 404 || err.status === 400)) {
      throw new RequestError('invalid_request', 'This fallback voice is not available.', 400, [
        { path: 'fallback_voice_id', message: 'Voice not available' },
      ])
    }
    throw err
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.get' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    return NextResponse.json(agent)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.get_failed', requestId)
  }
}

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.patch' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, PatchAgentSchema)

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    const current = agent as unknown as Record<string, unknown>

    // ── Agent columns ──────────────────────────────────────────────────────
    const agentPatch: Record<string, unknown> = {}
    for (const key of [...PROVIDER_FIELDS, ...LOCAL_FIELDS]) {
      const value = body[key]
      if (value === undefined) continue
      agentPatch[key] = TEXT_FIELDS.has(key) ? blankToNull(value as string | null) : value
    }
    if (body.metadata) agentPatch.metadata = mergeMetadata(agent.metadata, { personality: body.metadata.personality })

    const changed = (key: string) => key in agentPatch && stableJson(agentPatch[key]) !== stableJson(current[key])
    const providerFieldsChanged = PROVIDER_FIELDS.filter((k) => changed(k))

    if (changed('fallback_voice_id') && typeof agentPatch.fallback_voice_id === 'string') {
      await assertFallbackVoiceEligible(agentPatch.fallback_voice_id, log)
    }

    // ── Organization columns (tenant-writable: timezone, voice_fallback_enabled) ──
    const orgPatch: Record<string, unknown> = {}
    let fallbackTurnedOn = false
    let timezoneChanged = false
    if (body.organization) {
      const { data: orgRow, error: orgErr } = await supabase
        .from('organizations')
        .select('timezone, voice_fallback_enabled')
        .eq('id', org.id)
        .single()
      if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
      const { timezone, voice_fallback_enabled } = body.organization
      if (timezone !== undefined && timezone !== orgRow.timezone) {
        orgPatch.timezone = timezone
        timezoneChanged = true
      }
      if (voice_fallback_enabled !== undefined && voice_fallback_enabled !== orgRow.voice_fallback_enabled) {
        orgPatch.voice_fallback_enabled = voice_fallback_enabled
        fallbackTurnedOn = voice_fallback_enabled
      }
    }

    // Provider pushes are bounded per org (shared provider accounts). Checked
    // before any write so a 429 leaves nothing half-saved.
    const mayPush = providerFieldsChanged.length > 0 || timezoneChanged || fallbackTurnedOn || (agentPatch.is_active === true && !agent.is_active)
    if (mayPush) await enforceRateLimit(RATE_LIMITS.agentSync, org.id, 'Too many changes in a short time. Please wait a moment and save again.')

    // ── Writes (user-scoped client: RLS + column guard apply) ──────────────
    // fallback_voice_id is platform-managed (guard trigger): it was checked by
    // assertFallbackVoiceEligible above and is written with the service role.
    const { fallback_voice_id: fallbackVoiceId, ...tenantPatch } = agentPatch
    if ('fallback_voice_id' in agentPatch) {
      const { error } = await createAdminClient().from('agents').update({ fallback_voice_id: fallbackVoiceId }).eq('id', agent.id).eq('org_id', org.id)
      if (error) throw new Error(`agents fallback voice update failed: ${error.message}`)
    }
    if (Object.keys(tenantPatch).length) {
      const { error } = await supabase.from('agents').update(tenantPatch).eq('id', agent.id).eq('org_id', org.id)
      if (error) throw new Error(`agents update failed: ${error.message}`)
    }
    if (Object.keys(orgPatch).length) {
      const { error } = await supabase.from('organizations').update(orgPatch).eq('id', org.id)
      if (error) throw new Error(`organizations update failed: ${error.message}`)
    }

    // ── Provider propagation ───────────────────────────────────────────────
    const configChanged = providerFieldsChanged.length > 0 || timezoneChanged
    const primaryProvider = primaryProviderOf(agent)
    const activated =
      agentPatch.is_active === true &&
      !agent.is_active &&
      !(await hasExternalAgent(supabase, org.id, agent.id, primaryProvider))

    let sync: AgentSyncReport[] = []
    if (configChanged || activated || fallbackTurnedOn) {
      sync = await syncAgentProviders({
        supabase,
        orgId: org.id,
        agentId: agent.id,
        primaryProvider,
        bump: configChanged,
        primary: configChanged || activated,
        fallback: configChanged || activated || fallbackTurnedOn,
        log,
      })
    }

    log.info('agent.patch', {
      fields: Object.keys(agentPatch),
      organization: Object.keys(orgPatch),
      providerFieldsChanged,
      sync: sync.map((s) => `${s.provider}:${s.status}`),
    })

    const { data: saved, error: readErr } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent.id)
      .eq('org_id', org.id)
      .single()
    if (readErr) throw new Error(`agents read failed: ${readErr.message}`)

    return NextResponse.json({ agent: saved as Agent, sync })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.patch_failed', requestId)
  }
}
