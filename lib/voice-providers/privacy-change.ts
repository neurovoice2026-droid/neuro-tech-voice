// Whether a privacy change is STRICTER than what the provider last applied:
// recording turned off, or a shorter retention (a limit replacing "kept until
// deleted" counts too). Only then does the next ElevenLabs sync send
// apply_to_existing_conversations: true, once, so stored conversations follow
// the new rule. Loosening a setting is never retroactive, and an unknown
// previous state (agents synced before this was tracked) is not either:
// deleting existing recordings cannot be undone. Pure, client-safe.

import type { PrivacySettings } from './types'

export function readAppliedPrivacy(raw: unknown): PrivacySettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.record_audio !== 'boolean' || typeof r.retention_days !== 'number' || !Number.isInteger(r.retention_days)) return null
  return { record_audio: r.record_audio, retention_days: r.retention_days }
}

/** -1 means "kept until deleted" (no limit). */
function shorterRetention(previous: number, next: number): boolean {
  if (next < 0) return false
  if (previous < 0) return true
  return next < previous
}

export function isStricterPrivacy(previous: PrivacySettings | null, next: PrivacySettings): boolean {
  if (!previous) return false
  return (previous.record_audio && !next.record_audio) || shorterRetention(previous.retention_days, next.retention_days)
}
