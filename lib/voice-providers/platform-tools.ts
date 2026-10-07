import 'server-only'
// Platform ElevenLabs webhook tools and the workspace secret behind their
// X-NTV-Tool-Key header: created race-safely, then RECONCILED (not just
// created once).
//
//   ensureToolSecret()     stores ELEVENLABS_TOOL_SECRET once as a workspace
//                          secret (POST /v1/convai/secrets) and keeps only its
//                          id and a one-way fingerprint; a changed env value is
//                          PATCHed (rotation); a deleted secret is recreated.
//   ensurePlatformTool()   builds the full tool_config (lib/elevenlabs/tools),
//                          compares its hash with details.config_hash: PATCH on
//                          drift, recreate on 404, create when missing.
//   storedPlatformToolId() read-only (agent config hash: never creates anything).
//
// Creation is race-safe: a 'creating' lease row is claimed in
// platform_resources (insert-if-absent, or take over an expired lease) BEFORE
// the non-idempotent POST; before creating, a tool left behind by a crash
// (same name, same URL) is adopted; when another creator finished first, the
// duplicate we created is deleted. Failures are thrown, never swallowed: the
// agent sync turns them into a degraded status (adapters.ts).

import crypto from 'crypto'
import { createLogger, type Logger } from '@/lib/observability/logger'
import * as el from '@/lib/elevenlabs/client'
import * as toolsApi from '@/lib/elevenlabs/api/tools'
import * as secretsApi from '@/lib/elevenlabs/api/secrets'
import { buildWebhookToolConfig } from '@/lib/elevenlabs/tools/webhook-tool'
import { PLATFORM_TOOL_KEYS, PLATFORM_WEBHOOK_TOOLS, type PlatformToolKey } from '@/lib/elevenlabs/tools/definitions'
import { secretFingerprint, stableStringify, toolConfigHash } from '@/lib/elevenlabs/tools/hash'
import { toolSecretRequired, toolSecretValue } from '@/lib/elevenlabs/tools/secret-config'
import type { WebhookToolConfig } from '@/lib/elevenlabs/tools/types'
import { publicBaseUrl } from './config'
import { ProviderError, isProviderError, toProviderError } from './errors'
import {
  claimResourceLease,
  completeResourceLease,
  forgetPlatformResource,
  isReadyRow,
  pinnedResourceId,
  readResourceRow,
  releaseResourceLease,
  rememberPinnedResource,
  touchResourceChecked,
  updateResourceDetails,
  type PlatformResourceRow,
} from './platform-resources'

const baseLog = createLogger({ component: 'platform_tools' })

const SECRET_KEY = 'elevenlabs.tool_secret' as const
/** A creation (one POST) never takes this long; an older lease belongs to a crashed creator. */
const LEASE_MS = 60_000
/** Sync path: a verified tool is trusted this long per instance before the next GET. */
const VERIFY_TTL_MS = 10 * 60_000
const WAIT_STEP_MS = 400
const WAIT_MAX_MS = 6_000
const ADOPT_MAX_PAGES = 5

export type ToolAction = 'cached' | 'verified' | 'unverified' | 'patched' | 'created' | 'adopted' | 'recreated' | 'waited'

/**
 * Recorded on an agent sync that could not obtain the transfer tool
 * (agent_provider_resources.status 'degraded', last_error_code/last_error):
 * the agent offers to take a message instead. Tenant-safe wording.
 */
export const TRANSFER_TOOL_DEGRADED = {
  code: 'transfer_tool_unavailable',
  message: 'Human transfer is unavailable on calls to your app-routed numbers right now: your agent offers to take a message instead. This is retried automatically.',
} as const

export interface ToolEnsureResult {
  key: PlatformToolKey
  toolId: string
  action: ToolAction
}

export interface EnsureOptions {
  /** 'cached' (agent syncs): trust a recent verification. 'always' (maintenance, admin): GET the remote resource. */
  verify: 'cached' | 'always'
  log?: Logger
}

const verifiedTools = new Map<PlatformToolKey, { toolId: string; hash: string; at: number }>()

/** Forces the next ensure to verify remotely (an agent write referencing the tool failed). */
export function invalidatePlatformToolMemo(key?: PlatformToolKey): void {
  if (key) verifiedTools.delete(key)
  else verifiedTools.clear()
}

/** Test helper. */
export function resetPlatformToolMemo(): void {
  verifiedTools.clear()
}

function notConfigured(operation: string, detail: string, safeMessage = 'Human transfer is not configured on the platform.'): ProviderError {
  return new ProviderError({ system: 'elevenlabs', operation, code: 'not_configured', detail, safeMessage })
}

function conflict(operation: string, detail: string): ProviderError {
  return new ProviderError({ system: 'elevenlabs', operation, code: 'conflict', detail, safeMessage: 'A platform resource is being set up. It will be retried automatically.' })
}

const isNotFound = (err: unknown) => isProviderError(err) && err.code === 'not_found'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function requireBase(operation: string): string {
  if (!el.isConfigured()) throw notConfigured(operation, 'ELEVENLABS_API_KEY missing')
  const base = publicBaseUrl()
  if (!base) throw notConfigured(operation, 'VOICE_PUBLIC_BASE_URL missing')
  return base
}

/**
 * Name of this deployment's workspace secret: environment + a fingerprint of
 * the public host. One workspace can serve several deployments; adoption by
 * name must never pick (and overwrite) another deployment's secret.
 */
export function toolSecretName(baseUrl: string): string {
  const env = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'env'
  const host = crypto.createHash('sha256').update(new URL(baseUrl).host).digest('hex').slice(0, 8)
  return `ntv_tool_key_${env}_${host}`
}

// ─── Workspace secret ────────────────────────────────────────────────────────

/**
 * The workspace secret id holding ELEVENLABS_TOOL_SECRET, creating or
 * rotating it as needed. null only outside production when no key is
 * configured (tools then carry the per-call token header only).
 */
export async function ensureToolSecret(opts: EnsureOptions): Promise<string | null> {
  const log = opts.log ?? baseLog
  const value = toolSecretValue()
  if (!value) {
    if (toolSecretRequired()) throw notConfigured('secrets.ensure', 'ELEVENLABS_TOOL_SECRET missing or shorter than 32 characters')
    return null
  }
  const base = requireBase('secrets.ensure')
  const fp = secretFingerprint(value)
  // Always the stored row (one primary-key read), never an instance memo: a
  // secret recreated by another instance must not be overwritten by a stale id.
  const row = await readResourceRow(SECRET_KEY)
  if (isReadyRow(row)) {
    const id = row.external_id
    const name = typeof row.details.name === 'string' && row.details.name ? row.details.name : toolSecretName(base)
    if (row.details.value_fp === fp) {
      if (opts.verify === 'cached') return id
      try {
        await secretsApi.getSecret(id)
        await touchResourceChecked(SECRET_KEY, id)
        return id
      } catch (err) {
        if (!isNotFound(err)) throw err
        log.warn('tool_secret.missing_recreating')
        await forgetPlatformResource(SECRET_KEY, id)
        return await createSecretWithLease(base, value, fp, log)
      }
    }
    // ELEVENLABS_TOOL_SECRET changed: rotate in place (the secret id, and so the tool configs, stay the same).
    try {
      await secretsApi.updateSecret(id, { name, value })
    } catch (err) {
      if (!isNotFound(err)) throw err
      await forgetPlatformResource(SECRET_KEY, id)
      return await createSecretWithLease(base, value, fp, log)
    }
    await updateResourceDetails(SECRET_KEY, id, { ...row.details, name, value_fp: fp, rotated_at: new Date().toISOString() })
    log.warn('tool_secret.rotated', { hint: 'remove ELEVENLABS_TOOL_SECRET_PREVIOUS once in-flight calls are over' })
    return id
  }
  return await createSecretWithLease(base, value, fp, log)
}

async function waitForLease(key: PlatformToolKey | typeof SECRET_KEY, owner: string, operation: string): Promise<PlatformResourceRow | null> {
  const deadline = Date.now() + WAIT_MAX_MS
  for (;;) {
    if (await claimResourceLease(key, 'elevenlabs', owner, LEASE_MS)) return null
    const row = await readResourceRow(key)
    if (isReadyRow(row)) return row
    if (Date.now() >= deadline) throw conflict(operation, `${key} is being created elsewhere`)
    await sleep(WAIT_STEP_MS)
  }
}

async function createSecretWithLease(base: string, value: string, fp: string, log: Logger): Promise<string> {
  const owner = crypto.randomUUID()
  const ready = await waitForLease(SECRET_KEY, owner, 'secrets.create')
  if (ready) {
    // Another instance created it meanwhile (same deployment, same env value): rotate if needed.
    if (ready.details.value_fp === fp) return ready.external_id
    return (await ensureToolSecret({ verify: 'cached', log })) as string
  }
  const name = toolSecretName(base)
  let createdId: string | null = null
  try {
    // A secret left behind by a crash between POST and our DB write: adopt it.
    const page = await secretsApi.listSecrets({ search: name, page_size: 100 })
    const existing = (page.secrets ?? []).find((s) => s.name === name)
    let secretId: string
    if (existing) {
      await secretsApi.updateSecret(existing.secret_id, { name, value })
      secretId = existing.secret_id
    } else {
      const created = await secretsApi.createSecret({ name, value })
      if (!created?.secret_id) throw new ProviderError({ system: 'elevenlabs', operation: 'secrets.create', code: 'bad_response', detail: 'no secret_id' })
      createdId = created.secret_id
      secretId = created.secret_id
    }
    if (!(await completeResourceLease(SECRET_KEY, owner, secretId, { name, value_fp: fp }))) {
      if (createdId) await deleteDuplicate('secret', () => secretsApi.deleteSecret(createdId as string), log)
      const winner = await readResourceRow(SECRET_KEY)
      if (isReadyRow(winner)) return winner.external_id
      throw conflict('secrets.create', 'lease lost')
    }
    log.info(existing ? 'tool_secret.adopted' : 'tool_secret.created')
    return secretId
  } catch (err) {
    await releaseResourceLease(SECRET_KEY, owner)
    throw err
  }
}

async function deleteDuplicate(kind: 'tool' | 'secret', del: () => Promise<unknown>, log: Logger): Promise<void> {
  try {
    await del()
    log.warn('platform_tool.duplicate_deleted', { kind })
  } catch (err) {
    log.error('platform_tool.duplicate_delete_failed', err, { kind })
  }
}

// ─── Webhook tools ───────────────────────────────────────────────────────────

/** The complete desired tool_config and its hash (no provider call except the cached secret). */
export async function desiredToolConfig(key: PlatformToolKey, opts: EnsureOptions): Promise<{ config: WebhookToolConfig; hash: string; details: Record<string, unknown> }> {
  const base = requireBase('tools.ensure')
  // Secret verification is reconcilePlatformTools()'s job: the cached id is enough here.
  const secretId = await ensureToolSecret({ verify: 'cached', log: opts.log })
  const config = buildWebhookToolConfig(PLATFORM_WEBHOOK_TOOLS[key], { baseUrl: base, toolKeySecretId: secretId })
  const hash = toolConfigHash(config)
  // details hold no secret: the hash, the auth scheme (closes the legacy body-token path) and the host.
  return { config, hash, details: { config_hash: hash, auth: 'headers', name: config.name, host: new URL(base).host, key_header: !!secretId } }
}

/** Fields we own whose remote value differs (dashboard edits). undefined and null compare equal. */
export function remoteToolDrift(remote: Record<string, unknown> | null | undefined, desired: WebhookToolConfig): string[] {
  const norm = (v: unknown) => stableStringify(v ?? null)
  const out: string[] = []
  const r = remote ?? {}
  for (const k of ['type', 'name', 'description', 'response_timeout_secs', 'execution_mode', 'pre_tool_speech', 'interruption_mode', 'tool_error_handling_mode', 'tool_call_sound', 'tool_call_sound_behavior', 'follow_redirects']) {
    if (norm(r[k]) !== norm(desired[k])) out.push(k)
  }
  const ra = (r.api_schema ?? {}) as Record<string, unknown>
  const da = desired.api_schema as Record<string, unknown>
  for (const k of ['url', 'method', 'request_headers']) {
    if (norm(ra[k]) !== norm(da[k])) out.push(`api_schema.${k}`)
  }
  return out
}

/** A provider hiccup (timeout, 5xx, 429, open circuit, lease held elsewhere), not a verdict on the tool. */
function isTransient(err: unknown): boolean {
  return isProviderError(err) && (err.retryable || err.code === 'circuit_open' || err.code === 'conflict')
}

/**
 * The id of a platform webhook tool that exists with the current config.
 * Throws (ProviderError) when no usable tool can be obtained. When a tool
 * already exists and only a TRANSIENT failure prevents verifying or updating
 * it, that tool is kept ('unverified', possibly an older config): it served
 * calls until now, and the next sync or maintenance run reconciles it.
 */
export async function ensurePlatformTool(key: PlatformToolKey, opts: EnsureOptions): Promise<ToolEnsureResult> {
  const log = opts.log ?? baseLog
  const pinned = pinnedResourceId(key)
  const row = await readResourceRow(key)
  const currentId = pinned ?? (isReadyRow(row) ? row.external_id : null)
  const keepCurrent = (id: string, step: string, err: unknown): ToolEnsureResult => {
    log.warn('platform_tool.reconcile_deferred', { key, step, code: toProviderError(err, 'elevenlabs', `tools.${step}`).code })
    return { key, toolId: id, action: 'unverified' }
  }

  let desired: Awaited<ReturnType<typeof desiredToolConfig>>
  try {
    desired = await desiredToolConfig(key, opts)
  } catch (err) {
    if (currentId && isTransient(err)) return keepCurrent(currentId, 'config', err)
    throw err
  }
  if (!currentId) return createToolWithLease(key, desired, log)

  const storedHash = row && row.external_id === currentId ? row.details.config_hash : undefined
  const memo = verifiedTools.get(key)
  const remember = (action: ToolAction): ToolEnsureResult => {
    verifiedTools.set(key, { toolId: currentId, hash: desired.hash, at: Date.now() })
    return { key, toolId: currentId, action }
  }
  if (opts.verify === 'cached' && storedHash === desired.hash && memo?.toolId === currentId && memo.hash === desired.hash && Date.now() - memo.at < VERIFY_TTL_MS) {
    return { key, toolId: currentId, action: 'cached' }
  }

  let remote: toolsApi.ELTool | null = null
  try {
    remote = await toolsApi.getTool(currentId)
  } catch (err) {
    if (!isNotFound(err)) {
      if (isTransient(err)) return keepCurrent(currentId, 'get', err)
      throw err
    }
  }
  if (!remote) return recreate(key, currentId, !!pinned, desired, log)

  const drift = opts.verify === 'always' ? remoteToolDrift(remote.tool_config, desired.config) : []
  if (storedHash !== desired.hash || drift.length > 0) {
    try {
      await toolsApi.updateTool(currentId, desired.config)
    } catch (err) {
      if (isNotFound(err)) return recreate(key, currentId, !!pinned, desired, log)
      if (isTransient(err)) return keepCurrent(currentId, 'update', err)
      throw err
    }
    try {
      if (pinned) await rememberPinnedResource(key, 'elevenlabs', currentId, desired.details)
      else await updateResourceDetails(key, currentId, { ...(row?.details ?? {}), ...desired.details })
    } catch (err) {
      // The tool is up to date; an unrecorded hash only means one more PATCH next time.
      log.error('platform_tool.hash_write_failed', err, { key })
    }
    log.info('platform_tool.patched', { key, toolId: currentId, reason: storedHash !== desired.hash ? 'config' : 'remote_drift', drift })
    return remember('patched')
  }
  if (opts.verify === 'always') await touchResourceChecked(key, currentId)
  return remember('verified')
}

async function recreate(key: PlatformToolKey, missingId: string, pinned: boolean, desired: Awaited<ReturnType<typeof desiredToolConfig>>, log: Logger): Promise<ToolEnsureResult> {
  verifiedTools.delete(key)
  if (pinned) {
    // The operator owns a pinned id: report it, never replace it behind their back.
    throw new ProviderError({
      system: 'elevenlabs',
      operation: 'tools.get',
      code: 'not_found',
      detail: `pinned ${key} no longer exists`,
      safeMessage: 'The platform transfer tool is missing. It will be retried automatically.',
    })
  }
  log.warn('platform_tool.missing_recreating', { key, toolId: missingId })
  await forgetPlatformResource(key, missingId)
  const res = await createToolWithLease(key, desired, log)
  return { ...res, action: res.action === 'created' ? 'recreated' : res.action }
}

async function findAdoptableTool(config: WebhookToolConfig, log: Logger): Promise<string | null> {
  const page = await toolsApi.collectPages(
    (cursor) => toolsApi.listTools({ search: config.name, types: ['webhook'], cursor }).then((r) => ({ items: r.tools ?? [], next_cursor: r.next_cursor, has_more: r.has_more })),
    ADOPT_MAX_PAGES,
  )
  const matches = page.items.filter((t) => t.tool_config?.type === 'webhook' && t.tool_config?.api_schema?.url === config.api_schema.url)
  if (matches.length > 1) log.warn('platform_tool.duplicates_found', { name: config.name, count: matches.length })
  return matches[0]?.id ?? null
}

async function createToolWithLease(key: PlatformToolKey, desired: Awaited<ReturnType<typeof desiredToolConfig>>, log: Logger): Promise<ToolEnsureResult> {
  const owner = crypto.randomUUID()
  const ready = await waitForLease(key, owner, 'tools.create')
  if (ready) {
    verifiedTools.delete(key)
    // Created by another instance meanwhile; anything else to fix (config) is the next ensure's job.
    return { key, toolId: ready.external_id, action: 'waited' }
  }
  let createdId: string | null = null
  try {
    const adopted = await findAdoptableTool(desired.config, log)
    let toolId: string
    if (adopted) {
      await toolsApi.updateTool(adopted, desired.config)
      toolId = adopted
    } else {
      const created = await toolsApi.createTool(desired.config)
      if (!created?.id) throw new ProviderError({ system: 'elevenlabs', operation: 'tools.create', code: 'bad_response', detail: 'no tool id' })
      createdId = created.id
      toolId = created.id
    }
    if (!(await completeResourceLease(key, owner, toolId, desired.details))) {
      // Our lease expired and another creator finished first: keep theirs, delete ours (no agent references it yet).
      if (createdId) await deleteDuplicate('tool', () => toolsApi.deleteTool(createdId as string, { force: false }), log)
      const winner = await readResourceRow(key)
      if (isReadyRow(winner)) return { key, toolId: winner.external_id, action: 'waited' }
      throw conflict('tools.create', 'lease lost')
    }
    verifiedTools.set(key, { toolId, hash: desired.hash, at: Date.now() })
    log.info(adopted ? 'platform_tool.adopted' : 'platform_tool.created', { key, toolId })
    return { key, toolId, action: adopted ? 'adopted' : 'created' }
  } catch (err) {
    // A tool created before a failed DB write is adopted by the next attempt (same name and URL).
    await releaseResourceLease(key, owner)
    throw err
  }
}

/** Read-only: the stored (or pinned) tool id, never creating or calling the provider. For the agent config hash. */
export async function storedPlatformToolId(key: PlatformToolKey): Promise<string | null> {
  const pinned = pinnedResourceId(key)
  if (pinned) return pinned
  const row = await readResourceRow(key)
  return isReadyRow(row) ? row.external_id : null
}

export interface PlatformToolReport {
  configured: boolean
  secret: { status: 'ok' | 'not_configured' | 'error'; code?: string; message?: string }
  tools: Array<{ key: PlatformToolKey; status: 'ok' | 'error'; toolId?: string; action?: ToolAction; code?: string; message?: string }>
}

/** Verifies the secret and every platform tool remotely (maintenance, admin). Errors are reported and logged, never thrown. */
export async function reconcilePlatformTools(opts: { log?: Logger } = {}): Promise<PlatformToolReport> {
  const log = opts.log ?? baseLog
  if (!el.isConfigured()) return { configured: false, secret: { status: 'not_configured' }, tools: [] }
  const report: PlatformToolReport = { configured: true, secret: { status: 'ok' }, tools: [] }
  try {
    const id = await ensureToolSecret({ verify: 'always', log })
    if (!id) report.secret = { status: 'not_configured' }
  } catch (err) {
    const e = toProviderError(err, 'elevenlabs', 'secrets.ensure')
    log.error('platform_tools.secret_failed', err)
    report.secret = { status: e.code === 'not_configured' ? 'not_configured' : 'error', code: e.code, message: e.safeMessage }
  }
  for (const key of PLATFORM_TOOL_KEYS) {
    try {
      const res = await ensurePlatformTool(key, { verify: 'always', log })
      report.tools.push({ key, status: 'ok', toolId: res.toolId, action: res.action })
    } catch (err) {
      const e = toProviderError(err, 'elevenlabs', 'tools.ensure')
      log.error('platform_tools.tool_failed', err, { key })
      report.tools.push({ key, status: 'error', code: e.code, message: e.safeMessage })
    }
  }
  return report
}
