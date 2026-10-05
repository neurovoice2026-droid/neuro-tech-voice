import 'server-only'
// Idempotent webhook ingestion shared by every provider:
//   1. verify (route) → 2. persist in webhook_events with a unique dedupe key
//   → 3. answer 2xx → 4. process after the response (next/server after())
//   → 5. failures stay 'failed' with attempts; the maintenance job retries.
// A duplicate delivery (provider retry) of an already-processed event is
// acknowledged without touching anything. Payloads are kept only until the
// event is processed (PII minimisation); audio blobs are never stored.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent, deferBackground } from '@/lib/observability/telemetry'
import { applyCallEvent } from './call-store'
import { normalizeElevenLabsEvent, readEnvelope } from '@/lib/elevenlabs/webhook'
import { normalizeCartesiaEnvelope, readCartesiaEnvelope } from '@/lib/cartesia/webhook'
import { toProviderError } from './errors'

export type WebhookSource = 'elevenlabs' | 'cartesia'

const MAX_ATTEMPTS = 8

export interface IngestInput {
  provider: WebhookSource
  eventType: string
  dedupeKey: string
  externalId: string | null
  payload: unknown
}

export type IngestResult = { status: 'new' | 'retry'; id: string } | { status: 'duplicate'; id: string }

function stripBulk(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const copy = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
  const data = copy.data as Record<string, unknown> | undefined
  if (data && typeof data.full_audio === 'string') data.full_audio = '[omitted]'
  return copy
}

export async function ingestWebhookEvent(input: IngestInput): Promise<IngestResult> {
  const db = createAdminClient()
  const { data: inserted, error } = await db
    .from('webhook_events')
    .upsert(
      {
        provider: input.provider,
        event_type: input.eventType.slice(0, 80),
        dedupe_key: input.dedupeKey.slice(0, 300),
        external_id: input.externalId?.slice(0, 200) ?? null,
        payload: stripBulk(input.payload),
        status: 'received',
      },
      { onConflict: 'provider,dedupe_key', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw new Error(`webhook_events insert failed: ${error.message}`)
  if (inserted && inserted.length) return { status: 'new', id: inserted[0].id as string }

  const { data: existing, error: readErr } = await db
    .from('webhook_events')
    .select('id, status')
    .eq('provider', input.provider)
    .eq('dedupe_key', input.dedupeKey.slice(0, 300))
    .single()
  if (readErr) throw new Error(`webhook_events read failed: ${readErr.message}`)
  emitProviderEvent({ system: input.provider, kind: 'webhook_duplicate', ok: true, details: { event_type: input.eventType, status: existing.status } })
  if (existing.status === 'processed' || existing.status === 'ignored' || existing.status === 'processing') {
    return { status: 'duplicate', id: existing.id as string }
  }
  return { status: 'retry', id: existing.id as string }
}

async function handle(provider: WebhookSource, payload: unknown, log: Logger): Promise<{ callId: string | null; ignored: boolean }> {
  const event = provider === 'elevenlabs' ? normalizeElevenLabsEvent(readEnvelope(payload)) : normalizeCartesiaEnvelope(readCartesiaEnvelope(payload))
  if (!event) return { callId: null, ignored: true }
  const res = await applyCallEvent(event, log)
  return { callId: res.callId, ignored: res.outcome === 'unowned' }
}

/** Claims and processes one stored event. Never throws (records the failure). */
export async function processWebhookEvent(id: string, log: Logger = createLogger()): Promise<'processed' | 'ignored' | 'failed' | 'skipped'> {
  const db = createAdminClient()
  const { data: rows, error } = await db
    .from('webhook_events')
    .update({ status: 'processing' })
    .eq('id', id)
    .in('status', ['received', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .select('id, provider, event_type, payload, attempts')
  if (error) {
    log.error('webhook.claim_failed', error, { id })
    return 'failed'
  }
  const row = rows?.[0]
  if (!row) return 'skipped'
  const provider = row.provider as WebhookSource
  const l = log.child({ provider, webhookEventId: id, eventType: row.event_type })
  try {
    const { callId, ignored } = await handle(provider, row.payload, l)
    const { error: doneErr } = await db
      .from('webhook_events')
      .update({ status: ignored ? 'ignored' : 'processed', processed_at: new Date().toISOString(), payload: null, call_id: callId, attempts: (row.attempts as number) + 1, last_error: null })
      .eq('id', id)
    if (doneErr) l.error('webhook.mark_done_failed', doneErr)
    return ignored ? 'ignored' : 'processed'
  } catch (err) {
    const pe = toProviderError(err, provider, 'webhook.process')
    l.error('webhook.processing_failed', err)
    emitProviderEvent({ system: provider, kind: 'webhook_processing_failed', ok: false, errorCode: pe.code, details: { event_type: row.event_type, attempt: (row.attempts as number) + 1 } })
    const { error: failErr } = await db
      .from('webhook_events')
      .update({ status: 'failed', attempts: (row.attempts as number) + 1, last_error: (err instanceof Error ? err.message : String(err)).slice(0, 300) })
      .eq('id', id)
    if (failErr) l.error('webhook.mark_failed_failed', failErr)
    return 'failed'
  }
}

/** Process after the HTTP response has been sent (keeps the provider's request fast). */
export function processAfterResponse(id: string, log: Logger) {
  deferBackground(processWebhookEvent(id, log).then(() => undefined))
}

/** Maintenance: retries events that were received/failed more than a minute ago. */
export async function reprocessPendingWebhooks(limit = 50, log: Logger = createLogger({ component: 'webhook_retry' })) {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 60_000).toISOString()
  const { data, error } = await db
    .from('webhook_events')
    .select('id')
    .in('status', ['received', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .lt('received_at', cutoff)
    .order('received_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`webhook_events scan failed: ${error.message}`)
  const results: Record<string, number> = {}
  for (const r of data ?? []) {
    const out = await processWebhookEvent(r.id as string, log)
    results[out] = (results[out] ?? 0) + 1
  }
  // Stuck in 'processing' for > 15 min (instance died mid-run): release.
  const stuck = new Date(Date.now() - 15 * 60_000).toISOString()
  const { error: stuckErr } = await db.from('webhook_events').update({ status: 'failed', last_error: 'processing timed out' }).eq('status', 'processing').lt('received_at', stuck)
  if (stuckErr) log.error('webhook.release_stuck_failed', stuckErr)
  return results
}
