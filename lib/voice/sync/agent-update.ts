import type { Agent, WorkingHours } from '@/types'
import { sanitizeKeyterms } from '@/lib/voice/languages'
import { normalizeTone } from '@/lib/voice/tone'
import type { AgentPatch } from '@/lib/voice/sync/schemas'

// Turns a validated PATCH body into the column update for the agents row.
// Pure, so the merge rules (metadata sub-keys, working hours per day, the
// legacy personality field) are unit-tested without a database.

export interface AgentUpdatePlan {
  /** Columns to write. */
  update: Record<string, unknown>
  /** Columns derived for compatibility rather than asked for; safe to drop before migration 010. */
  derived: Set<string>
}

const DIRECT_FIELDS = [
  'name', 'language', 'system_prompt', 'first_message', 'fallback_message', 'tone',
  'voice_speed', 'voice_emotion', 'lead_fields', 'recording_notice', 'is_active',
] as const satisfies readonly (keyof AgentPatch & keyof Agent)[]

/**
 * Two PATCH bodies as one, the way the server would apply them in order:
 * later fields win, while metadata sub-keys and working-hours days merge. The
 * dashboard's debounced auto-save uses it so a quick second edit doesn't
 * replace the first one before it was sent.
 */
export function mergeAgentPatchBodies<T extends { metadata?: object | null; working_hours?: object | null }>(first: T, second: T): T {
  const merged: Record<string, unknown> = { ...first }
  for (const [key, value] of Object.entries(second)) {
    // An explicit undefined isn't sent by JSON.stringify, so it must not erase the first edit.
    if (value !== undefined) merged[key] = value
  }
  for (const key of ['metadata', 'working_hours'] as const) {
    const a = first[key]
    const b = second[key]
    if (a && b) merged[key] = { ...a, ...b }
  }
  return merged as T
}

export function buildAgentUpdate(
  patch: AgentPatch,
  current: Pick<Agent, 'metadata' | 'working_hours' | 'cartesia_voice_id' | 'cartesia_voice_name'>,
  verifiedVoiceName?: string | null
): AgentUpdatePlan {
  const update: Record<string, unknown> = {}
  const derived = new Set<string>()

  for (const field of DIRECT_FIELDS) {
    if (patch[field] !== undefined) update[field] = patch[field]
  }

  if (patch.keyterms !== undefined) update.keyterms = sanitizeKeyterms(patch.keyterms)

  if (patch.cartesia_voice_id !== undefined) {
    update.cartesia_voice_id = patch.cartesia_voice_id
    const sameVoice = patch.cartesia_voice_id === current.cartesia_voice_id
    update.cartesia_voice_name =
      patch.cartesia_voice_name?.trim() || verifiedVoiceName || (sameVoice ? current.cartesia_voice_name : null)
  } else if (patch.cartesia_voice_name !== undefined && current.cartesia_voice_id) {
    update.cartesia_voice_name = patch.cartesia_voice_name?.trim() || null
  }

  if (patch.working_hours !== undefined) {
    // Days not sent keep their saved hours.
    const saved = (current.working_hours && typeof current.working_hours === 'object' ? current.working_hours : {}) as WorkingHours
    update.working_hours = { ...saved, ...patch.working_hours }
  }

  const meta = patch.metadata
  if (meta) {
    const metadata: Record<string, unknown> = { ...(current.metadata ?? {}) }
    let changed = false
    for (const key of ['behavior_settings', 'outside_hours', 'holiday_mode', 'not_in_documents_message'] as const) {
      if (meta[key] !== undefined) {
        metadata[key] = meta[key]
        changed = true
      }
    }
    if (meta.personality !== undefined) {
      const tone = normalizeTone(patch.tone ?? meta.personality)
      metadata.personality = tone
      changed = true
      if (patch.tone === undefined) {
        update.tone = tone
        derived.add('tone')
      }
    }
    if (changed) update.metadata = metadata
  }

  return { update, derived }
}
