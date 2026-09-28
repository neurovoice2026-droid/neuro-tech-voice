import 'server-only'
// The calendar entry point exports the same OAuth2 client class as the full
// `googleapis` package, without loading every Google API (≈10× faster cold start).
import { auth as googleAuth } from 'googleapis/build/src/apis/calendar'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { appUrl, env, isGoogleConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { decryptSecret, encryptSecret, isEncryptionConfigured, sha256Hex } from '@/lib/security/crypto'
import { kvGet, kvSet } from '@/lib/kv'
import {
  GOOGLE_IDENTITY_SCOPES,
  GOOGLE_INTEGRATION_TYPES,
  GOOGLE_SCOPES,
  isGoogleIntegrationType,
  parseGrantedScopes,
  scopesForType,
  type GoogleIntegrationType,
} from '@/lib/google/scopes'

// Google OAuth for the Workspace integrations (Calendar, Gmail, Sheets, Docs,
// Drive). One row per integration type in `integrations`; each holds its own
// refresh token, encrypted at rest (AES-256-GCM, lib/security/crypto.ts) in
// google_refresh_token_encrypted. Rows from before encryption still carry the
// plaintext google_refresh_token: the first read encrypts it and clears the
// plaintext. Every read and write here goes through the service-role client
// with an explicit org_id filter, because migration 011 hides the token
// columns from signed-in users.

export type { GoogleIntegrationType } from '@/lib/google/scopes'
export { GOOGLE_INTEGRATION_TYPES, GOOGLE_SCOPES, isGoogleIntegrationType, missingScopes, scopesForType } from '@/lib/google/scopes'

export type GoogleOAuthClient = InstanceType<typeof googleAuth.OAuth2>

export type GoogleConnectionErrorCode =
  | 'not_configured'
  | 'encryption_not_configured'
  | 'migration_missing'
  | 'no_refresh_token'
  | 'storage_failed'

export class GoogleConnectionError extends Error {
  readonly code: GoogleConnectionErrorCode

  constructor(code: GoogleConnectionErrorCode, message: string) {
    super(message)
    this.name = 'GoogleConnectionError'
    this.code = code
  }
}

/** Access tokens are reused until shortly before they expire (they last one hour). */
const ACCESS_TOKEN_MARGIN_MS = 2 * 60_000
const REVOKE_TIMEOUT_MS = 5_000
/**
 * Default for every request the OAuth client makes itself: code exchange,
 * access-token refresh and revocation. Those calls take no per-request
 * signal, so without a default a stalled Google endpoint would hang the
 * request (or a live tool call) until the platform kills it. API calls that
 * pass their own timeout or signal keep theirs.
 */
const GOOGLE_HTTP_TIMEOUT_MS = 15_000

const warned = new Set<string>()
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn('[google]', message)
}

/** Postgres undefined_column: migration 010 (encrypted token column) isn't applied. */
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703'
}

// ─── OAuth client and consent URL ───────────────────────────────────────────

/** GOOGLE_REDIRECT_URI when set, else the app's own callback route. */
export function googleRedirectUri(): string {
  return env.GOOGLE_REDIRECT_URI ?? `${appUrl()}/api/integrations/google/callback`
}

export function getGoogleOAuthClient(): GoogleOAuthClient {
  return new googleAuth.OAuth2({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: googleRedirectUri(),
    // A cached access token Google has already invalidated gets one refresh
    // and retry, so only a truly broken grant surfaces as an auth error.
    forceRefreshOnFailure: true,
    transporterOptions: { timeout: GOOGLE_HTTP_TIMEOUT_MS },
  })
}

/**
 * Consent URL for one integration. `state` is `<type>.<nonce>`; when no type
 * is passed it is read from the state. Offline access with a forced consent
 * screen guarantees a refresh token; include_granted_scopes keeps what the
 * account already granted to this app.
 */
export function getGoogleOAuthUrl(state: string, opts: { type?: GoogleIntegrationType; loginHint?: string | null } = {}): string {
  const stateType = state.split('.')[0]
  const type = opts.type ?? (isGoogleIntegrationType(stateType) ? stateType : null)
  const scope = type
    ? scopesForType(type)
    : [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_INTEGRATION_TYPES.flatMap((t) => GOOGLE_SCOPES[t])]
  return getGoogleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope,
    state,
    ...(opts.loginHint ? { login_hint: opts.loginHint } : {}),
  })
}

/** OAuth client for a known refresh token; access tokens are refreshed on demand. */
export function getGoogleClientWithToken(refreshToken: string): GoogleOAuthClient {
  const client = getGoogleOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

// ─── Stored tokens ──────────────────────────────────────────────────────────

interface StoredToken {
  rowId: string
  refreshToken: string
}

interface IntegrationTokenRow {
  id: string
  type?: string
  is_active: boolean | null
  config?: Record<string, unknown> | null
  google_refresh_token: string | null
  google_refresh_token_encrypted?: string | null
}

async function selectTokenRows(
  admin: SupabaseClient,
  orgId: string,
  types: readonly GoogleIntegrationType[]
): Promise<{ rows: IntegrationTokenRow[]; encryptedColumn: boolean }> {
  const current = await admin
    .from('integrations')
    .select('id, type, is_active, google_refresh_token, google_refresh_token_encrypted')
    .eq('org_id', orgId)
    .in('type', [...types])
  if (!current.error) return { rows: (current.data ?? []) as IntegrationTokenRow[], encryptedColumn: true }
  if (!isMissingColumn(current.error)) {
    console.error('[google] integration lookup failed', current.error.code, current.error.message)
    throw new Error('Google integration lookup failed')
  }
  warnOnce('legacy-schema', 'integrations has no google_refresh_token_encrypted column yet; apply migration 010')
  const legacy = await admin
    .from('integrations')
    .select('id, type, is_active, google_refresh_token')
    .eq('org_id', orgId)
    .in('type', [...types])
  if (legacy.error) {
    console.error('[google] integration lookup failed', legacy.error.code, legacy.error.message)
    throw new Error('Google integration lookup failed')
  }
  return { rows: (legacy.data ?? []) as IntegrationTokenRow[], encryptedColumn: false }
}

/** Refresh token of a row, or null when it has none or it can't be decrypted. */
function readRowToken(row: IntegrationTokenRow): string | null {
  if (row.google_refresh_token_encrypted) {
    if (!isEncryptionConfigured()) {
      warnOnce('no-key', 'TOKEN_ENCRYPTION_KEY is missing or invalid, so stored Google tokens cannot be read')
      return null
    }
    try {
      return decryptSecret(row.google_refresh_token_encrypted)
    } catch (error) {
      console.error('[google] stored refresh token could not be decrypted', row.type ?? '', error instanceof Error ? error.message : '')
      return null
    }
  }
  return row.google_refresh_token || null
}

/** Encrypts a legacy plaintext token in place. Best effort: the token still works if this fails. */
async function migrateLegacyToken(admin: SupabaseClient, orgId: string, rowId: string, plain: string): Promise<void> {
  try {
    const { error } = await admin
      .from('integrations')
      .update({ google_refresh_token_encrypted: encryptSecret(plain), google_refresh_token: null })
      .eq('id', rowId)
      .eq('org_id', orgId)
    if (error) console.error('[google] legacy token encryption failed', error.code, error.message)
  } catch (error) {
    console.error('[google] legacy token encryption failed', error instanceof Error ? error.message : error)
  }
}

async function loadStoredToken(orgId: string, type: GoogleIntegrationType): Promise<StoredToken | null> {
  const admin = createAdminClient()
  const { rows, encryptedColumn } = await selectTokenRows(admin, orgId, [type])
  const row = rows[0]
  if (!row || row.is_active === false) return null
  const refreshToken = readRowToken(row)
  if (!refreshToken) return null
  if (!row.google_refresh_token_encrypted && encryptedColumn && isEncryptionConfigured()) {
    await migrateLegacyToken(admin, orgId, row.id, refreshToken)
  }
  return { rowId: row.id, refreshToken }
}

// ─── Authorized clients ─────────────────────────────────────────────────────

interface CachedAccessToken {
  access_token: string
  expiry_date: number
}

function accessTokenKey(orgId: string, type: GoogleIntegrationType, refreshToken: string): string {
  // Keyed by a hash of the refresh token, so reconnecting never reuses an old access token.
  return `google:at:${orgId}:${type}:${sha256Hex(refreshToken).slice(0, 16)}`
}

async function readCachedAccessToken(key: string): Promise<CachedAccessToken | null> {
  if (!isEncryptionConfigured()) return null
  const sealed = await kvGet<string>(key)
  if (typeof sealed !== 'string') return null
  try {
    const value = JSON.parse(decryptSecret(sealed)) as Partial<CachedAccessToken>
    if (typeof value.access_token !== 'string' || typeof value.expiry_date !== 'number') return null
    return value.expiry_date - ACCESS_TOKEN_MARGIN_MS > Date.now() ? (value as CachedAccessToken) : null
  } catch {
    return null
  }
}

async function cacheAccessToken(key: string, accessToken: string, expiryDate: number): Promise<void> {
  if (!isEncryptionConfigured()) return
  const ttlSeconds = Math.floor((expiryDate - ACCESS_TOKEN_MARGIN_MS - Date.now()) / 1000)
  if (ttlSeconds < 30) return
  // Encrypted: the KV store (Redis or kv_store) is not a secrets store.
  await kvSet(key, encryptSecret(JSON.stringify({ access_token: accessToken, expiry_date: expiryDate })), Math.min(ttlSeconds, 3600))
}

async function storeRotatedRefreshToken(orgId: string, rowId: string, refreshToken: string): Promise<void> {
  if (!isEncryptionConfigured()) return
  const { error } = await createAdminClient()
    .from('integrations')
    .update({ google_refresh_token_encrypted: encryptSecret(refreshToken), google_refresh_token: null })
    .eq('id', rowId)
    .eq('org_id', orgId)
  if (error) console.error('[google] storing a rotated refresh token failed', error.code, error.message)
}

/**
 * OAuth client for an org's connected integration, or null when it isn't
 * connected (no row, disconnected, no readable token, or Google OAuth not
 * configured). Access tokens refresh automatically and are shared between
 * requests through the KV store, so back-to-back tool calls in one phone call
 * don't each pay for a token refresh.
 */
export async function getAuthorizedClient(orgId: string, type: GoogleIntegrationType): Promise<GoogleOAuthClient | null> {
  if (!isGoogleConfigured() || !isSupabaseAdminConfigured()) return null
  const stored = await loadStoredToken(orgId, type)
  if (!stored) return null

  const client = getGoogleOAuthClient()
  const cacheKey = accessTokenKey(orgId, type, stored.refreshToken)
  const cached = await readCachedAccessToken(cacheKey)
  client.setCredentials({
    refresh_token: stored.refreshToken,
    ...(cached ? { access_token: cached.access_token, expiry_date: cached.expiry_date } : {}),
  })
  client.on('tokens', (tokens) => {
    const tasks: Promise<void>[] = []
    if (tokens.access_token && tokens.expiry_date) {
      tasks.push(cacheAccessToken(cacheKey, tokens.access_token, tokens.expiry_date))
    }
    if (tokens.refresh_token && tokens.refresh_token !== stored.refreshToken) {
      tasks.push(storeRotatedRefreshToken(orgId, stored.rowId, tokens.refresh_token))
    }
    Promise.all(tasks).catch((error: unknown) => {
      console.error('[google] token bookkeeping failed', error instanceof Error ? error.message : error)
    })
  })
  return client
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export interface GoogleErrorInfo {
  status: number | null
  /** Google's error reason / OAuth error code, e.g. invalid_grant, notFound, rateLimitExceeded. */
  reason: string | null
  message: string
}

export function googleErrorInfo(error: unknown): GoogleErrorInfo {
  if (!error || typeof error !== 'object') return { status: null, reason: null, message: String(error) }
  const e = error as {
    status?: unknown
    code?: unknown
    message?: unknown
    response?: { status?: unknown; data?: unknown }
    errors?: { reason?: unknown }[]
  }
  const status =
    typeof e.response?.status === 'number' ? e.response.status : typeof e.status === 'number' ? e.status : typeof e.code === 'number' ? e.code : null
  const data = e.response?.data as { error?: unknown; error_description?: unknown } | undefined
  let reason: string | null = null
  if (typeof data?.error === 'string') reason = data.error
  else if (data?.error && typeof data.error === 'object') {
    const inner = data.error as { errors?: { reason?: unknown }[]; status?: unknown }
    const first = inner.errors?.[0]?.reason
    reason = typeof first === 'string' ? first : typeof inner.status === 'string' ? inner.status : null
  }
  if (!reason && Array.isArray(e.errors) && typeof e.errors[0]?.reason === 'string') reason = e.errors[0].reason as string
  if (!reason && typeof e.code === 'string') reason = e.code
  const message = typeof e.message === 'string' ? e.message : 'Google request failed'
  return { status, reason, message }
}

/**
 * The connection itself is broken (revoked access, expired grant, missing
 * permission) and only reconnecting fixes it, as opposed to a temporary error.
 */
export function isGoogleAuthError(error: unknown): boolean {
  const { status, reason, message } = googleErrorInfo(error)
  if (reason === 'invalid_grant' || reason === 'unauthorized_client' || reason === 'insufficientPermissions') return true
  if (/invalid_grant|insufficient permission|insufficient authentication scopes/i.test(message)) return true
  return status === 401
}

/**
 * Marks an integration as needing a reconnect: off (so the agent stops
 * offering it) with the reason in config for the integrations page.
 */
export async function markGoogleIntegrationBroken(orgId: string, type: GoogleIntegrationType, reason: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('integrations').select('config').eq('org_id', orgId).eq('type', type).maybeSingle()
    const config = data?.config && typeof data.config === 'object' ? (data.config as Record<string, unknown>) : {}
    const { error } = await admin
      .from('integrations')
      .update({
        is_active: false,
        config: { ...config, last_error: reason.slice(0, 300), last_error_at: new Date().toISOString() },
      })
      .eq('org_id', orgId)
      .eq('type', type)
    if (error) console.error('[google] marking integration as disconnected failed', error.code, error.message)
    else console.warn('[google] integration needs reconnecting', { orgId, type })
  } catch (error) {
    console.error('[google] marking integration as disconnected failed', error instanceof Error ? error.message : error)
  }
}

// ─── Connect, revoke, disconnect ────────────────────────────────────────────

export interface StoreGoogleConnectionInput {
  orgId: string
  type: GoogleIntegrationType
  /** null when Google didn't return a new one; the stored token is kept. */
  refreshToken: string | null
  scopes: string[]
  accountEmail: string | null
}

/** Saves a completed OAuth connection. Never stores a plaintext token. */
export async function storeGoogleConnection(input: StoreGoogleConnectionInput): Promise<void> {
  if (!isGoogleConfigured() || !isSupabaseAdminConfigured()) {
    throw new GoogleConnectionError('not_configured', 'Google sign-in is not configured.')
  }
  if (!isEncryptionConfigured()) {
    throw new GoogleConnectionError('encryption_not_configured', 'TOKEN_ENCRYPTION_KEY is missing or invalid.')
  }
  const admin = createAdminClient()
  const existing = await admin
    .from('integrations')
    .select('id, config, is_active, google_refresh_token, google_refresh_token_encrypted')
    .eq('org_id', input.orgId)
    .eq('type', input.type)
    .maybeSingle()
  if (existing.error) {
    if (isMissingColumn(existing.error)) {
      throw new GoogleConnectionError('migration_missing', 'The database is missing the encrypted token column (migration 010).')
    }
    console.error('[google] integration lookup failed', existing.error.code, existing.error.message)
    throw new GoogleConnectionError('storage_failed', 'Could not save the Google connection.')
  }
  const row = existing.data as (IntegrationTokenRow & { config: Record<string, unknown> | null }) | null
  if (!input.refreshToken && !(row && readRowToken(row))) {
    throw new GoogleConnectionError('no_refresh_token', 'Google did not return offline access.')
  }

  // A fresh connection clears the "needs reconnecting" note left by an earlier failure.
  const config = { ...(row?.config && typeof row.config === 'object' ? row.config : {}) }
  delete config.last_error
  delete config.last_error_at

  const values: Record<string, unknown> = {
    org_id: input.orgId,
    type: input.type,
    is_active: true,
    connected_at: new Date().toISOString(),
    scopes: input.scopes,
    account_email: input.accountEmail,
    config,
  }
  if (input.refreshToken) {
    values.google_refresh_token_encrypted = encryptSecret(input.refreshToken)
    values.google_refresh_token = null
  } else if (row && !row.google_refresh_token_encrypted && row.google_refresh_token) {
    values.google_refresh_token_encrypted = encryptSecret(row.google_refresh_token)
    values.google_refresh_token = null
  }

  const { error } = await admin.from('integrations').upsert(values, { onConflict: 'org_id,type' })
  if (error) {
    if (isMissingColumn(error)) {
      throw new GoogleConnectionError('migration_missing', 'The database is missing the integration columns (migration 010).')
    }
    console.error('[google] saving the connection failed', error.code, error.message)
    throw new GoogleConnectionError('storage_failed', 'Could not save the Google connection.')
  }
}

export interface GoogleTokenExchange {
  refreshToken: string | null
  scopes: string[]
  idToken: string | null
}

/** Exchanges an authorization code. Throws on any Google error (the caller logs and redirects). */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokenExchange> {
  const { tokens } = await getGoogleOAuthClient().getToken(code)
  return {
    refreshToken: tokens.refresh_token ?? null,
    scopes: parseGrantedScopes(tokens.scope),
    idToken: tokens.id_token ?? null,
  }
}

async function revokeToken(token: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      getGoogleOAuthClient().revokeToken(token),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('revoke timed out')), REVOKE_TIMEOUT_MS)
      }),
    ])
    return true
  } catch (error) {
    const { status, reason } = googleErrorInfo(error)
    // Already revoked or expired: the goal is reached.
    if (status === 400 && (reason === 'invalid_token' || reason === null)) return true
    console.error('[google] revoking a token failed', status, reason)
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Revokes the org's Google grants and clears the stored tokens (account
 * deletion, or disconnecting the last Google integration). Revoking one
 * refresh token revokes that account's whole grant to this app, so rows of
 * other types are cleared too unless `types` narrows it. Never throws: a
 * failed revoke is logged and counted, and the tokens are cleared anyway.
 */
export async function revokeGoogleAccess(
  orgId: string,
  opts: { types?: readonly GoogleIntegrationType[] } = {}
): Promise<{ revoked: number; failed: number }> {
  if (!isSupabaseAdminConfigured()) return { revoked: 0, failed: 0 }
  const types = opts.types?.length ? opts.types : GOOGLE_INTEGRATION_TYPES
  let revoked = 0
  let failed = 0
  try {
    const admin = createAdminClient()
    const { rows, encryptedColumn } = await selectTokenRows(admin, orgId, types)
    const tokens = new Set<string>()
    for (const row of rows) {
      const token = readRowToken(row)
      if (token) tokens.add(token)
    }
    if (tokens.size > 0 && isGoogleConfigured()) {
      const results = await Promise.all([...tokens].map((token) => revokeToken(token)))
      revoked = results.filter(Boolean).length
      failed = results.length - revoked
    }
    if (rows.length > 0) {
      const cleared: Record<string, unknown> = { is_active: false, google_refresh_token: null }
      if (encryptedColumn) cleared.google_refresh_token_encrypted = null
      const { error } = await admin
        .from('integrations')
        .update(cleared)
        .eq('org_id', orgId)
        .in('id', rows.map((row) => row.id))
      if (error) console.error('[google] clearing stored tokens failed', error.code, error.message)
    }
  } catch (error) {
    console.error('[google] revoking access failed', error instanceof Error ? error.message : error)
    failed += 1
  }
  return { revoked, failed }
}

/**
 * Removes one Google integration. The grant is revoked only when no other
 * Google integration of the org is still active: revoking would break those.
 */
export async function disconnectGoogleIntegration(orgId: string, type: GoogleIntegrationType): Promise<{ revoked: boolean }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integrations')
    .select('type')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('type', GOOGLE_INTEGRATION_TYPES.filter((t) => t !== type))
  if (error) {
    console.error('[google] integration lookup failed', error.code, error.message)
    throw new Error('Google integration lookup failed')
  }
  let revoked = false
  if ((data ?? []).length === 0) {
    const result = await revokeGoogleAccess(orgId)
    revoked = result.revoked > 0
  }
  const removal = await admin.from('integrations').delete().eq('org_id', orgId).eq('type', type)
  if (removal.error) {
    console.error('[google] removing the integration failed', removal.error.code, removal.error.message)
    throw new Error('Removing the Google integration failed')
  }
  return { revoked }
}
