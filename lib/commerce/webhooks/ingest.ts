import 'server-only'
// Webhook ingestion (app/api/commerce/webhooks/[platform]/[publicId]):
//   1. the raw bytes are read once, bounded;
//   2. the connection is resolved from the random public id in the path
//      (never from anything in the body or an org id);
//   3. the adapter verifies the signature over those bytes;
//   4. one idempotency row per (connection, dedupe key) is written; a
//      duplicate is acknowledged and never processed twice;
//   5. 2xx goes back at once; processing happens in the worker.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { RATE_LIMITS, rateLimit } from '@/lib/security/rate-limit'
import { adapterFor, isCommercePlatform } from '../adapters'
import type { RawWebhookRequest } from '../adapters/types'
import { CommerceCryptoError } from '../crypto'
import { applyEvents } from '../events'
import { type ConnectionRow, loadConnection, loadConnectionByPublicId, toAdapterConnection, writeAudit } from '../store'

export const MAX_WEBHOOK_BYTES = 1024 * 1024
export const WEBHOOK_LEASE_SECONDS = 90

export type IngestResult =
  | { status: 200; body: { ok: true; accepted: boolean; duplicate?: boolean } }
  | { status: 401 | 400 | 404 | 413 | 429 | 503; body: { ok: false; error: string } }

export interface WebhookEventRow {
  id: string
  org_id: string
  connection_id: string
  platform: string
  dedupe_key: string
  topic: string
  verified: boolean
  status: 'received' | 'processing' | 'processed' | 'failed' | 'ignored'
  attempts: number
  max_attempts: number
  payload: unknown
  external_resource_id: string | null
  received_at: string
}

export const WEBHOOK_EVENT_COLUMNS = 'id, org_id, connection_id, platform, dedupe_key, topic, verified, status, attempts, max_attempts, payload, external_resource_id, received_at'

export function dedupeKeyFor(deliveryId: string | null, rawBody: Uint8Array, topic: string): string {
  const bodyHash = createHash('sha256').update(rawBody).digest('hex')
  // Delivery ids of some platforms repeat within a second: the body hash disambiguates.
  return deliveryId ? `${topic}:${deliveryId.slice(0, 120)}:${bodyHash.slice(0, 16)}` : `${topic}:body:${bodyHash}`
}

export async function ingestWebhook(
  db: SupabaseClient,
  input: { platform: string; publicId: string; request: RawWebhookRequest },
  log: Logger,
): Promise<IngestResult> {
  if (!isCommercePlatform(input.platform)) return { status: 404, body: { ok: false, error: 'unknown platform' } }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(input.publicId)) return { status: 404, body: { ok: false, error: 'unknown endpoint' } }
  if (input.request.rawBody.byteLength > MAX_WEBHOOK_BYTES) return { status: 413, body: { ok: false, error: 'payload too large' } }
  const connection = await loadConnectionByPublicId(db, input.platform, input.publicId)
  if (!connection) {
    log.warn('commerce.webhook.unknown_endpoint', { platform: input.platform })
    return { status: 404, body: { ok: false, error: 'unknown endpoint' } }
  }
  const l = log.child({ orgId: connection.org_id, connectionId: connection.id, provider: input.platform })
  if (!(await rateLimit(RATE_LIMITS.commerceWebhook, connection.id)).allowed) {
    l.warn('commerce.webhook.rate_limited')
    return { status: 429, body: { ok: false, error: 'too many deliveries' } }
  }
  if (connection.status === 'disconnected') return { status: 404, body: { ok: false, error: 'unknown endpoint' } }

  let adapterConn
  try {
    adapterConn = toAdapterConnection(connection)
  } catch (err) {
    if (err instanceof CommerceCryptoError) {
      l.error('commerce.webhook.credentials_unreadable', null, { code: err.code })
      return { status: 503, body: { ok: false, error: 'temporarily unavailable' } }
    }
    throw err
  }
  const adapter = adapterFor(connection.platform)
  const verified = await adapter.verifyWebhook(input.request, adapterConn)
  if (!verified.ok) {
    l.warn('commerce.webhook.rejected', { reason: verified.reason })
    await noteDelivery(db, connection, { ok: false, reason: verified.reason }, l)
    return { status: verified.status, body: { ok: false, error: verified.reason === 'not_supported' ? 'webhooks are not supported for this connection' : 'verification failed' } }
  }
  const dedupeKey = dedupeKeyFor(verified.deliveryId, input.request.rawBody, verified.topic)
  const { error } = await db.from('commerce_webhook_events').insert({
    org_id: connection.org_id,
    connection_id: connection.id,
    platform: connection.platform,
    dedupe_key: dedupeKey,
    topic: verified.topic.slice(0, 120),
    verified: true,
    status: 'received',
    payload: verified.payload ?? null,
    external_resource_id: verified.externalResourceId?.slice(0, 128) ?? null,
  })
  if (error) {
    if (error.code === '23505') {
      l.info('commerce.webhook.duplicate', { topic: verified.topic })
      return { status: 200, body: { ok: true, accepted: false, duplicate: true } }
    }
    throw new Error(`commerce_webhook_events insert failed: ${error.message}`)
  }
  await noteDelivery(db, connection, { ok: true }, l)
  l.info('commerce.webhook.accepted', { topic: verified.topic })
  return { status: 200, body: { ok: true, accepted: true } }
}

/** Keeps the connection's last delivery / last rejection for the dashboard (best effort). */
async function noteDelivery(db: SupabaseClient, connection: ConnectionRow, result: { ok: true } | { ok: false; reason: string }, log: Logger): Promise<void> {
  const cfg = connection.webhook_config && typeof connection.webhook_config === 'object' ? { ...(connection.webhook_config as Record<string, unknown>) } : {}
  const now = new Date().toISOString()
  if (result.ok) {
    cfg.last_delivery_at = now
  } else {
    cfg.last_error = result.reason === 'bad_signature' ? 'Semnătura unui webhook a fost respinsă.' : `Webhook respins (${result.reason}).`
    cfg.last_error_at = now
  }
  const { error } = await db.from('commerce_connections').update({ webhook_config: cfg }).eq('id', connection.id)
  if (error) log.error('commerce.webhook.note_failed', error)
}

export async function claimWebhookEvents(db: SupabaseClient, owner: string, limit: number): Promise<WebhookEventRow[]> {
  const { data, error } = await db.rpc('commerce_claim_webhook_events', { p_owner: owner, p_limit: limit, p_lease_seconds: WEBHOOK_LEASE_SECONDS })
  if (error) throw new Error(`commerce_claim_webhook_events failed: ${error.message}`)
  return (data ?? []) as WebhookEventRow[]
}

/** Processes one claimed event: normalize → apply → mark processed (payload cleared) or failed with backoff. */
export async function processWebhookEvent(db: SupabaseClient, event: WebhookEventRow, owner: string, log: Logger): Promise<'processed' | 'ignored' | 'failed' | 'retry'> {
  const l = log.child({ orgId: event.org_id, connectionId: event.connection_id, provider: event.platform, eventId: event.id })
  const settle = async (patch: Record<string, unknown>) => {
    const { error } = await db.from('commerce_webhook_events').update({ ...patch, lease_owner: null, lease_until: null }).eq('id', event.id).eq('lease_owner', owner)
    if (error) l.error('commerce.webhook.settle_failed', error)
  }
  try {
    const connection = await loadConnection(db, event.connection_id)
    if (!connection || connection.status === 'disconnected') {
      await settle({ status: 'ignored', processed_at: new Date().toISOString(), payload: null, error_code: 'connection_inactive' })
      return 'ignored'
    }
    const adapter = adapterFor(connection.platform)
    const events = adapter.normalizeEvent({ ok: true, topic: event.topic, deliveryId: null, externalResourceId: event.external_resource_id, payload: event.payload }, toAdapterConnection(connection))
    const real = events.filter((e) => e.kind !== 'ignored')
    if (!real.length) {
      await settle({ status: 'ignored', processed_at: new Date().toISOString(), payload: null })
      return 'ignored'
    }
    const counts = await applyEvents({ db, connection, log: l }, real)
    await settle({ status: 'processed', processed_at: new Date().toISOString(), payload: null, error_code: null, error_message: null })
    l.info('commerce.webhook.processed', { topic: event.topic, counts })
    return 'processed'
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'processing failed'
    l.error('commerce.webhook.process_failed', err, { attempts: event.attempts })
    if (event.attempts < event.max_attempts) {
      const delay = Math.min(60, 2 ** Math.max(0, event.attempts - 1)) * 60_000
      await settle({ status: 'received', run_after: new Date(Date.now() + delay).toISOString(), error_code: 'processing_failed', error_message: message })
      return 'retry'
    }
    await settle({ status: 'failed', processed_at: new Date().toISOString(), error_code: 'processing_failed', error_message: message })
    await writeAudit(db, { orgId: event.org_id, actor: 'webhook', action: 'webhook.failed', connectionId: event.connection_id, metadata: { topic: event.topic, code: 'processing_failed' } }, l)
    return 'failed'
  }
}
