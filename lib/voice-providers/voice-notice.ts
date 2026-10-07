import 'server-only'
// ElevenLabs workspace webhook `voice_library_removal_notice` (event types
// voice_removal_notice, voice_removal_notice_withdrawn, voice_removed; the
// payload is not in the OpenAPI spec, so it is read defensively). A notice
// only triggers the library lifecycle check of the voices it names early:
// polling (library-lifecycle.ts) stays the source of truth, and nothing from
// the payload (dates, ids of voices we do not hold) is trusted or stored.

import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { checkLibraryVoices } from './library-lifecycle'
import { EL_VOICE_ID_RE } from './voice-catalog'

export const VOICE_NOTICE_TYPES = new Set(['voice_removal_notice', 'voice_removal_notice_withdrawn', 'voice_removed'])

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})

export interface VoiceNotice {
  type: string
  eventTimestamp: number | null
  voiceIds: string[]
}

/** Every voice id the payload names under a known key (top level, data, data.voice), validated. */
export function readVoiceNotice(body: unknown): VoiceNotice {
  const b = obj(body)
  const data = obj(b.data)
  const voice = obj(data.voice)
  const ids = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && EL_VOICE_ID_RE.test(v)) ids.add(v)
  }
  for (const src of [b, data, voice]) {
    add(src.voice_id)
    add(src.original_voice_id)
    add(src.public_voice_id)
    add(src.shared_voice_id)
    if (Array.isArray(src.voice_ids)) src.voice_ids.slice(0, 100).forEach(add)
  }
  const ts = typeof b.event_timestamp === 'number' && Number.isFinite(b.event_timestamp) ? b.event_timestamp : null
  return { type: typeof b.type === 'string' ? b.type.slice(0, 80) : '', eventTimestamp: ts, voiceIds: [...ids].slice(0, 100) }
}

export function voiceNoticeDedupeKey(n: VoiceNotice): string {
  return `${n.type}:${[...n.voiceIds].sort().join(',') || 'none'}:${n.eventTimestamp ?? 'none'}`.slice(0, 300)
}

/** Keys of the payload (never values), logged once per delivery to pin down the undocumented shape. */
export function payloadShape(body: unknown): { top: string[]; data: string[] } {
  return { top: Object.keys(obj(body)).slice(0, 20), data: Object.keys(obj(obj(body).data)).slice(0, 30) }
}

/**
 * Stores the receipt (dedupe: provider retries) and returns whether it is new.
 * Only the event type, the voice ids and the timestamp are kept.
 */
export async function recordVoiceNotice(n: VoiceNotice): Promise<{ id: string; isNew: boolean }> {
  const db = createAdminClient()
  const dedupeKey = voiceNoticeDedupeKey(n)
  const { data, error } = await db
    .from('webhook_events')
    .upsert(
      {
        provider: 'elevenlabs',
        event_type: n.type,
        dedupe_key: dedupeKey,
        external_id: n.voiceIds[0] ?? null,
        payload: { type: n.type, voice_ids: n.voiceIds, event_timestamp: n.eventTimestamp },
        // Processed right away; never picked up by the call-event reprocessor.
        status: 'processing',
      },
      { onConflict: 'provider,dedupe_key', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw new Error(`webhook_events insert failed: ${error.message}`)
  if (data && data.length) return { id: data[0].id as string, isNew: true }
  const { data: existing, error: readErr } = await db.from('webhook_events').select('id').eq('provider', 'elevenlabs').eq('dedupe_key', dedupeKey).single()
  if (readErr) throw new Error(`webhook_events read failed: ${readErr.message}`)
  return { id: existing.id as string, isNew: false }
}

/** Runs the lifecycle check for the named voices and closes the receipt. Never throws. */
export async function processVoiceNotice(id: string, n: VoiceNotice, log: Logger): Promise<void> {
  const db = createAdminClient()
  let status: 'processed' | 'ignored' = 'ignored'
  let lastError: string | null = null
  try {
    if (n.voiceIds.length) {
      const report = await checkLibraryVoices({ voiceIds: n.voiceIds, log })
      status = report.checked > 0 ? 'processed' : 'ignored'
      log.info('voice_notice.checked', { type: n.type, voices: n.voiceIds.length, checked: report.checked, removed: report.removed, notices: report.notices })
    }
  } catch (err) {
    // Closed as 'ignored' with the error kept: a 'failed' receipt would be
    // claimed by the post-call reprocessor (webhook-ingest.ts), and the
    // scheduled lifecycle check re-reads these voices anyway.
    lastError = err instanceof Error ? err.message.slice(0, 300) : 'failed'
    log.error('voice_notice.check_failed', err, { type: n.type })
  }
  const { error } = await db
    .from('webhook_events')
    .update({ status, processed_at: new Date().toISOString(), payload: null, attempts: 1, last_error: lastError })
    .eq('id', id)
  if (error) log.error('voice_notice.mark_failed', error, { id })
}
