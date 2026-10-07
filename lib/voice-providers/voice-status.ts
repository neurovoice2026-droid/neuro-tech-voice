import 'server-only'
// What the dashboard shows about the agent's CURRENT voice: its kind and any
// notice (default voices retired on 2026-12-31, library voices scheduled for
// removal or removed, voices no longer offered). Only the org's own agent and
// registry rows visible to the org are read; nothing about other tenants.

import * as el from '@/lib/elevenlabs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from './errors'
import { DEFAULT_VOICE_RETIREMENT_AT, defaultVoiceMigrationAt, pinRemoteVoice } from './default-voices'
import { defaultVoiceIds } from './voice-catalog'

export type AgentVoiceKind = 'none' | 'premade' | 'library' | 'cloned' | 'designed' | 'other' | 'unknown'
export type AgentVoiceNoticeCode = 'default_voice_retirement' | 'removal_scheduled' | 'removed' | 'moderation' | 'custom_rate' | 'blocked'

export interface AgentVoiceNotice {
  code: AgentVoiceNoticeCode
  /** When the voice stops working (ISO), if known. */
  at: string | null
  /** When the platform switches the agent automatically (ISO), if it will. */
  auto_switch_at: string | null
  message: string
}

export interface AgentVoiceStatus {
  voice_id: string | null
  voice_name: string | null
  kind: AgentVoiceKind
  notice: AgentVoiceNotice | null
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function defaultVoiceNotice(now: Date = new Date()): AgentVoiceNotice {
  const autoAt = defaultVoiceMigrationAt()
  const switching = now.getTime() >= autoAt.getTime()
  return {
    code: 'default_voice_retirement',
    at: DEFAULT_VOICE_RETIREMENT_AT,
    auto_switch_at: autoAt.toISOString(),
    message: switching
      ? `This voice will stop working on ${formatDay(DEFAULT_VOICE_RETIREMENT_AT)} — choose a new voice. We are switching your agent to a recommended voice for its language.`
      : `This voice will stop working on ${formatDay(DEFAULT_VOICE_RETIREMENT_AT)} — choose a new voice. If you don't, we will switch your agent to a recommended voice for its language on ${formatDay(autoAt.toISOString())}.`,
  }
}

export function registryNotice(notice: string | null | undefined, retiringAt: string | null | undefined): AgentVoiceNotice | null {
  switch (notice) {
    case 'removal_scheduled':
      return {
        code: 'removal_scheduled',
        at: retiringAt ?? null,
        auto_switch_at: null,
        message: retiringAt
          ? `The owner of this voice is removing it from the voice library on ${formatDay(retiringAt)}. Choose a new voice before then.`
          : 'The owner of this voice is removing it from the voice library. Choose a new voice soon.',
      }
    case 'removed':
      return {
        code: 'removed',
        at: retiringAt ?? null,
        auto_switch_at: null,
        message: 'This voice was removed by its owner and no longer works. Choose a new voice.',
      }
    case 'moderation':
    case 'custom_rate':
    case 'blocked':
      return {
        code: notice,
        at: null,
        auto_switch_at: null,
        message: 'This voice is no longer offered for new selections. It keeps working for now, but we recommend choosing another voice.',
      }
    default:
      return null
  }
}

/**
 * Status of the org's agent's current voice. An agent saved without a voice
 * but already created at the provider gets the provider's voice pinned first
 * (see default-voices.ts pinRemoteVoice).
 */
export async function agentVoiceStatus(params: {
  orgId: string
  agent: { id: string; voice_id: string | null; voice_name: string | null }
  log: Logger
}): Promise<AgentVoiceStatus> {
  const { orgId, log } = params
  let voiceId = params.agent.voice_id
  let voiceName = params.agent.voice_name
  if (!voiceId) {
    try {
      voiceId = await pinRemoteVoice({ orgId, agentId: params.agent.id, log })
    } catch (err) {
      log.warn('voice_status.pin_failed', { error: isProviderError(err) ? err.code : 'unknown' })
    }
    if (!voiceId) return { voice_id: null, voice_name: null, kind: 'none', notice: null }
    voiceName = null
  }

  const db = createAdminClient()
  const { data: row, error } = await db
    .from('provider_voices')
    .select('source, owner_org_id, name, notice, retiring_at, status')
    .eq('provider', 'elevenlabs')
    .eq('voice_id', voiceId)
    .maybeSingle()
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  if (row && (row.owner_org_id === null || row.owner_org_id === orgId)) {
    const kind: AgentVoiceKind = row.source === 'library' || row.source === 'cloned' || row.source === 'designed' ? row.source : row.source === 'premade' ? 'premade' : 'other'
    const notice = kind === 'premade' ? defaultVoiceNotice() : registryNotice(row.notice as string | null, row.retiring_at as string | null)
    return { voice_id: voiceId, voice_name: voiceName ?? ((row.name as string | null) ?? null), kind, notice }
  }
  if (row) {
    // Another org's voice on this agent can only be legacy data: say nothing about it.
    log.warn('voice_status.foreign_registry_voice', { voiceId })
    return { voice_id: voiceId, voice_name: voiceName, kind: 'unknown', notice: null }
  }

  const defaults = await defaultVoiceIds(log)
  if (defaults?.has(voiceId)) return { voice_id: voiceId, voice_name: voiceName, kind: 'premade', notice: defaultVoiceNotice() }
  try {
    const v = await el.voices.get(voiceId, { orgId })
    if (v.category === 'premade') return { voice_id: voiceId, voice_name: voiceName ?? v.name ?? null, kind: 'premade', notice: defaultVoiceNotice() }
    return { voice_id: voiceId, voice_name: voiceName, kind: 'other', notice: null }
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') {
      return { voice_id: voiceId, voice_name: voiceName, kind: 'other', notice: registryNotice('removed', null) }
    }
    log.warn('voice_status.lookup_failed', { error: isProviderError(err) ? err.code : 'unknown' })
    return { voice_id: voiceId, voice_name: voiceName, kind: 'unknown', notice: null }
  }
}
