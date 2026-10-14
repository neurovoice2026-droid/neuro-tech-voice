import 'server-only'
// Connection lifecycle: connect (validate against the real platform, store
// the encrypted secrets, register webhooks, queue the first import), test,
// disconnect (credentials erased, webhooks removed, data kept) and delete
// (everything removed). No "connected" state without a real validation.

import type { SupabaseClient } from '@supabase/supabase-js'
import { RequestError } from '@/lib/api/http'
import type { Logger } from '@/lib/observability/logger'
import { adapterFor } from './adapters'
import { ConnectionError, type ConnectionSecrets, type ValidatedStore } from './adapters/types'
import { CommerceCryptoError, commerceCryptoConfigured, currentKeyVersion } from './crypto'
import { StoreHttpError, UnsafeUrlError } from './safe-fetch'
import { CONNECTION_COLUMNS, type ConnectionRow, type WebhookConfig, encryptedSecretsFor, enqueueSyncJob, loadConnection, newWebhookPublicId, readWebhookConfig, toAdapterConnection, webhookUrlFor, writeAudit } from './store'
import type { CommercePlatform } from './types'

/** Maps an adapter/network failure to a merchant-facing 4xx/5xx (never the raw provider body). */
export function connectionRequestError(err: unknown): RequestError {
  if (err instanceof ConnectionError) {
    const status = err.code === 'not_configured' ? 503 : 409
    return new RequestError(err.code === 'not_configured' ? 'not_configured' : 'precondition_failed', err.publicMessage, status, { reason: err.code, retryable: err.retryable })
  }
  if (err instanceof UnsafeUrlError) return new RequestError('invalid_request', 'Adresa magazinului nu este permisă (doar https, fără adrese interne).', 400, { reason: 'ssrf_blocked' })
  if (err instanceof StoreHttpError) {
    const reason = err.code === 'timeout' ? 'timeout' : err.code === 'redirect' ? 'redirect' : 'unreachable'
    return new RequestError('precondition_failed', reason === 'timeout' ? 'Magazinul nu a răspuns la timp.' : reason === 'redirect' ? 'Magazinul răspunde cu o redirecționare: folosește adresa finală https.' : 'Magazinul nu a putut fi contactat.', 409, { reason, retryable: true })
  }
  if (err instanceof CommerceCryptoError) {
    if (err.code === 'not_configured' || err.code === 'invalid_key') return new RequestError('not_configured', 'Criptarea datelor de acces nu este configurată pe platformă.', 503, { reason: 'encryption_not_configured' })
    // The stored envelope cannot be read (key version no longer available, tampered, malformed): only a reconnect fixes it.
    return new RequestError('precondition_failed', 'Datele de acces nu pot fi citite: reconectează magazinul.', 409, { reason: 'credentials_unreadable', retryable: false })
  }
  if (err instanceof RequestError) return err
  throw err
}

export interface ConnectInput {
  orgId: string
  userId: string | null
  platform: CommercePlatform
  storeUrl: string
  displayName: string | null
  secrets: ConnectionSecrets
}

/**
 * Validates and stores a connection. An existing row of the same
 * org/platform/domain is reconnected in place (same id, same webhook URL),
 * so the mirrors and automations survive a key rotation.
 */
export async function connectStore(db: SupabaseClient, input: ConnectInput, log: Logger): Promise<ConnectionRow> {
  if (!commerceCryptoConfigured()) throw new RequestError('not_configured', 'Criptarea datelor de acces nu este configurată pe platformă (COMMERCE_CREDENTIALS_ENCRYPTION_KEY).', 503, { reason: 'encryption_not_configured' })
  const adapter = adapterFor(input.platform)
  let validated: ValidatedStore
  try {
    validated = await adapter.validateConnection({ storeUrl: input.storeUrl, secrets: input.secrets }, log)
  } catch (err) {
    log.warn('commerce.connect.validation_failed', { platform: input.platform, code: err instanceof ConnectionError ? err.code : err instanceof Error ? err.name : 'unknown' })
    throw connectionRequestError(err)
  }
  const { data: existing, error: readErr } = await db
    .from('commerce_connections')
    .select('id, webhook_public_id, status')
    .eq('org_id', input.orgId)
    .eq('platform', input.platform)
    .eq('store_domain', validated.storeDomain)
    .maybeSingle()
  if (readErr) throw new Error(`commerce_connections read failed: ${readErr.message}`)
  const id = (existing?.id as string | undefined) ?? crypto.randomUUID()
  const publicId = (existing?.webhook_public_id as string | undefined) ?? newWebhookPublicId()
  const row = {
    id,
    org_id: input.orgId,
    platform: input.platform,
    store_url: validated.storeUrl,
    store_domain: validated.storeDomain,
    display_name: input.displayName?.trim() || validated.displayName || null,
    status: 'connecting',
    capabilities: validated.capabilities,
    ...encryptedSecretsFor({ id, org_id: input.orgId }, validated.secrets),
    webhook_public_id: publicId,
    error_code: null,
    error_message: null,
    connected_at: new Date().toISOString(),
    disconnected_at: null,
    updated_at: new Date().toISOString(),
  }
  const { error: upErr } = await db.from('commerce_connections').upsert(row, { onConflict: 'id' })
  if (upErr) throw new Error(`commerce_connections upsert failed: ${upErr.message}`)
  await writeAudit(db, { orgId: input.orgId, actor: 'user', actorUserId: input.userId, action: existing ? 'connection.reconnected' : 'connection.created', connectionId: id, metadata: { platform: input.platform, domain: validated.storeDomain, version: validated.platformVersion } }, log)

  // Webhooks: a failure here is not fatal (polling covers it) but is shown.
  let webhookConfig: WebhookConfig = { registrations: [], last_error: null, last_error_at: null, last_delivery_at: null }
  let status: ConnectionRow['status'] = 'active'
  const current = await loadConnection(db, id)
  if (!current) throw new Error('commerce_connections row vanished after upsert')
  try {
    const regs = await adapter.registerWebhooks(toAdapterConnection(current), log)
    webhookConfig = { ...webhookConfig, registrations: regs }
  } catch (err) {
    const code = err instanceof ConnectionError ? err.code : 'webhook_registration_failed'
    log.warn('commerce.connect.webhooks_failed', { platform: input.platform, code })
    webhookConfig = { ...webhookConfig, last_error: err instanceof ConnectionError ? err.publicMessage : 'Webhook-urile nu au putut fi înregistrate; datele ajung prin sincronizare periodică.', last_error_at: new Date().toISOString() }
    status = validated.capabilities.webhooks ? 'degraded' : 'active'
  }
  const { error: cfgErr } = await db.from('commerce_connections').update({ webhook_config: webhookConfig, status }).eq('id', id)
  if (cfgErr) throw new Error(`commerce_connections update failed: ${cfgErr.message}`)
  await enqueueSyncJob(db, { orgId: input.orgId, connectionId: id, kind: 'initial', resource: 'all' })
  const final = await loadConnection(db, id)
  if (!final) throw new Error('commerce_connections row vanished')
  log.info('commerce.connect.ok', { platform: input.platform, connectionId: id, status, webhooks: webhookConfig.registrations.length })
  return final
}

export interface TestResult {
  ok: boolean
  message: string
  capabilities: ValidatedStore['capabilities'] | null
}

/** Re-validates the stored credentials against the platform; updates status/error accordingly. */
export async function testConnection(db: SupabaseClient, row: ConnectionRow, log: Logger): Promise<TestResult> {
  if (!row.encrypted_credentials) return { ok: false, message: 'Conexiunea nu are date de acces: reconectează magazinul.', capabilities: null }
  const adapter = adapterFor(row.platform)
  try {
    const conn = toAdapterConnection(row)
    const validated = await adapter.validateConnection({ storeUrl: row.store_url, secrets: conn.secrets }, log)
    // A key rotation completes here too: a row still wrapped with the previous key is re-wrapped under the current one.
    const rewrap = row.credential_key_version !== currentKeyVersion() ? encryptedSecretsFor(row, conn.secrets) : {}
    const { error } = await db
      .from('commerce_connections')
      .update({ capabilities: validated.capabilities, error_code: null, error_message: null, ...rewrap, ...(row.status === 'error' || row.status === 'degraded' ? { status: 'active' } : {}) })
      .eq('id', row.id)
    if (error) throw new Error(`commerce_connections update failed: ${error.message}`)
    return { ok: true, message: 'Conexiunea funcționează.', capabilities: validated.capabilities }
  } catch (err) {
    const mapped = connectionRequestError(err)
    const reason = (mapped.details as { reason?: string } | undefined)?.reason ?? mapped.code
    const fatal = reason === 'unauthorized' || reason === 'forbidden' || reason === 'credentials_unreadable'
    const { error } = await db
      .from('commerce_connections')
      .update({ error_code: reason, error_message: mapped.message, ...(row.status === 'active' || row.status === 'degraded' ? { status: fatal ? 'error' : 'degraded' } : {}) })
      .eq('id', row.id)
    if (error) log.error('commerce.test.update_failed', error)
    return { ok: false, message: mapped.message, capabilities: null }
  }
}

/** Credentials erased, webhooks removed, queued work cancelled; mirrored data and automations kept (paused). */
export async function disconnectStore(db: SupabaseClient, row: ConnectionRow, userId: string | null, log: Logger): Promise<ConnectionRow> {
  if (row.encrypted_credentials) {
    try {
      await adapterFor(row.platform).unregisterWebhooks(toAdapterConnection(row), log)
    } catch (err) {
      // The merchant may already have revoked the key; the record is still disconnected.
      log.warn('commerce.disconnect.unregister_failed', { connectionId: row.id, code: err instanceof ConnectionError ? err.code : 'unknown' })
    }
  }
  const now = new Date().toISOString()
  // Queued work first (every step is idempotent): a failure here leaves the
  // connection active, so a retried disconnect repeats the cancellations
  // instead of being short-circuited as "already disconnected".
  const { error: autoErr } = await db.from('commerce_automations').update({ enabled: false }).eq('connection_id', row.id)
  if (autoErr) throw new Error(`commerce_automations update failed: ${autoErr.message}`)
  const { error: jobsErr } = await db.from('commerce_sync_jobs').update({ status: 'cancelled', finished_at: now }).eq('connection_id', row.id).in('status', ['pending', 'running'])
  if (jobsErr) throw new Error(`commerce_sync_jobs update failed: ${jobsErr.message}`)
  const { error: runsErr } = await db
    .from('commerce_automation_runs')
    .update({ status: 'cancelled', eligibility_reason: 'Magazinul a fost deconectat', completed_at: now })
    .eq('connection_id', row.id)
    .in('status', ['eligible', 'scheduled', 'retry_waiting'])
  if (runsErr) throw new Error(`commerce_automation_runs update failed: ${runsErr.message}`)
  const { error } = await db
    .from('commerce_connections')
    .update({ status: 'disconnected', encrypted_credentials: null, credential_key_version: null, webhook_config: { ...readWebhookConfig(row.webhook_config), registrations: [] }, disconnected_at: now, error_code: null, error_message: null })
    .eq('id', row.id)
  if (error) throw new Error(`commerce_connections update failed: ${error.message}`)
  await writeAudit(db, { orgId: row.org_id, actor: 'user', actorUserId: userId, action: 'connection.disconnected', connectionId: row.id, metadata: { platform: row.platform } }, log)
  const final = await loadConnection(db, row.id)
  if (!final) throw new Error('commerce_connections row vanished')
  return final
}

/** Removes the connection and, by cascade, every mirrored record, automation, run and job. */
export async function deleteStore(db: SupabaseClient, row: ConnectionRow, userId: string | null, log: Logger): Promise<void> {
  if (row.status !== 'disconnected') await disconnectStore(db, row, userId, log)
  const { error } = await db.from('commerce_connections').delete().eq('id', row.id).eq('org_id', row.org_id)
  if (error) throw new Error(`commerce_connections delete failed: ${error.message}`)
  await writeAudit(db, { orgId: row.org_id, actor: 'user', actorUserId: userId, action: 'connection.deleted', metadata: { platform: row.platform, domain: row.store_domain } }, log)
}

/** Where a platform must send webhooks (shown to merchants of platforms with manual registration). */
export function publicWebhookUrl(row: ConnectionRow): string | null {
  return webhookUrlFor(row.platform, row.webhook_public_id)
}

/**
 * Finishes a key rotation without merchant action (worker housekeeping):
 * re-wraps, a small batch per tick, the credentials still encrypted under an
 * older key version — readable only while COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS
 * is set. Idempotent; an envelope that cannot be read is left for a reconnect
 * (counted once per tick, never logged with its content).
 */
export async function rewrapCredentials(db: SupabaseClient, log: Logger, limit = 20): Promise<number> {
  if (!commerceCryptoConfigured()) return 0
  const current = currentKeyVersion()
  const { data, error } = await db.from('commerce_connections').select(CONNECTION_COLUMNS).not('encrypted_credentials', 'is', null).lt('credential_key_version', current).limit(limit)
  if (error) throw new Error(`commerce_connections read failed: ${error.message}`)
  let rewrapped = 0
  let unreadable = 0
  for (const row of (data ?? []) as ConnectionRow[]) {
    let patch: ReturnType<typeof encryptedSecretsFor>
    try {
      patch = encryptedSecretsFor(row, toAdapterConnection(row).secrets)
    } catch (err) {
      if (!(err instanceof CommerceCryptoError)) throw err
      unreadable++
      continue
    }
    // Only the version that was read is replaced: a reconnect that landed meanwhile is never overwritten.
    const { error: updErr } = await db.from('commerce_connections').update(patch).eq('id', row.id).eq('credential_key_version', row.credential_key_version)
    if (updErr) {
      log.error('commerce.credentials.rewrap_failed', updErr, { connectionId: row.id })
      continue
    }
    rewrapped++
  }
  if (rewrapped) log.info('commerce.credentials.rewrapped', { count: rewrapped, keyVersion: current })
  if (unreadable) log.warn('commerce.credentials.rewrap_unreadable', { count: unreadable, keyVersion: current })
  return rewrapped
}
