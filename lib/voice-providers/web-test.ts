import 'server-only'
// Browser test sessions: "Talk to your agent" (WebRTC voice) and "Chat with
// your agent" (text only) on the agent page and at the end of onboarding.
//
//   startWebTestSession()  POST /api/agent/web-session
//     1. the org's OWN agent and its ready ElevenLabs agent (ids from our DB
//        only, never from the browser); it must be switched on, and never
//        created here;
//     2. rate limits (per org, per org per day, per client IP), the
//        server-side seconds budget (below) and, for unpaid organisations, a
//        lifetime session cap claimed atomically in the DB
//        (claim_web_test_session, migration 020);
//     3. GET /v1/convai/conversation/token (never retried: each attempt is a
//        new billed conversation) with an opaque participant name;
//     4. a pre-created calls row (channel 'web', is_test, provider
//        elevenlabs, the token's conversation id): the post-call webhook
//        merges into it through the existing row path, so the session is
//        never billed and never starts the owner's automations.
//   The token is a bearer credential: returned once, never logged or stored.
//
//   Seconds budget (server-side: the panel's timer is client-side only and a
//   modified browser can skip it). recordWebTestSeconds() accounts the length
//   of every browser test conversation once, when its post-call data is merged
//   (call-store.ts → record_web_test_seconds, keyed by calls.id). A new session
//   is refused once the budget is spent: unpaid orgs get
//   WEB_TEST_TRIAL_SECONDS for life, paid orgs WEB_TEST_DAILY_SECONDS per UTC
//   day. One session longer than twice WEB_TEST_MAX_SECONDS proves the cap was
//   bypassed: the org's browser tests are blocked until a platform admin
//   resets them (resetWebTestBlock / reset_web_test_block).
//
//   finalizeStaleWebTests()  maintenance step `web_test_finalize`: test rows
//   whose post-call result never arrived (session never connected, webhook
//   lost and not recovered) are closed after 2 hours. Never billed.
//
// Dynamic variables for the session come from the shared client-data builder
// (routing mode 'web', direction inbound, the real after-hours state and the
// business name). No call token is ever handed to the browser: the platform
// tools (transfer, booking, take a message) see the 'none' placeholder and
// refuse politely, and the prompt tells the agent so (prompt.ts).

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { RequestError } from '@/lib/api/http'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { isConfigured } from '@/lib/elevenlabs/client'
import { conversationToken } from '@/lib/elevenlabs/api/conversation-token'
import { overridesInForce } from '@/lib/elevenlabs/client-overrides'
import { platformVariables } from '@/lib/telephony/client-data'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { PLANS } from '@/types'
import { PLATFORM_VARIABLES } from './prompt'
import { readAfterHours, readConversationSettings, readPrivacySettings, readWorkingHours } from './settings'
import { evaluateWorkingHours } from './working-hours'
import { voiceTokenSecret } from './config'
import { RANK } from './call-merge'
import { ProviderError } from './errors'

export const WEB_TEST_MODES = ['voice', 'text'] as const
export type WebTestMode = (typeof WEB_TEST_MODES)[number]

/** Override path a text-only session needs (platform_settings.overrides, agent-config.ts). */
export const OVERRIDE_TEXT_ONLY = 'conversation.text_only'

/** Test rows still open this long after the token was minted are closed. */
export const WEB_TEST_FINALIZE_AFTER_MS = 2 * 60 * 60_000

/**
 * Lost-webhook recovery (conversation-reconcile.ts) tries a row at most
 * MAX_ATTEMPTS (6) times. A test row starts with 4 attempts used: it gets 2
 * look-ups, so abandoned tests (a token minted, the session never connected)
 * cannot crowd phone calls out of the recovery budget.
 */
export const WEB_TEST_RECONCILE_ATTEMPTS_USED = 4

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= min && v <= max ? v : fallback
}

/** Lifetime browser tests of an unpaid (trial) organisation (WEB_TEST_TRIAL_SESSIONS, 0–1000, default 20; 0 = none). */
export const webTestTrialSessions = () => envInt('WEB_TEST_TRIAL_SESSIONS', 20, 0, 1000)
/** Client-side length cap of one browser test (WEB_TEST_MAX_SECONDS, 60–1800, default 300). */
export const webTestMaxSeconds = () => envInt('WEB_TEST_MAX_SECONDS', 300, 60, 1800)
/** Lifetime seconds of browser tests of an unpaid organisation (WEB_TEST_TRIAL_SECONDS, 0–86400, default 1800; 0 = none). */
export const webTestTrialSeconds = () => envInt('WEB_TEST_TRIAL_SECONDS', 1800, 0, 86_400)
/** Seconds of browser tests per UTC day of a paid organisation (WEB_TEST_DAILY_SECONDS, 0–86400, default 3600; 0 = none). */
export const webTestDailySeconds = () => envInt('WEB_TEST_DAILY_SECONDS', 3600, 0, 86_400)
/** One session longer than this bypassed the panel's cap: the org's browser tests are blocked (admin reset). */
export const webTestBlockAfterSeconds = () => 2 * webTestMaxSeconds()
/** A session is not started with less budget left than this. */
export const WEB_TEST_MIN_SESSION_SECONDS = 30

/** A plan the organisation pays for (Stripe sets it; checkout in progress stays 'trial'). */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return !!plan && plan !== 'trial' && Object.hasOwn(PLANS, plan)
}

/** Opaque, stable participant label for the provider: never the user's email or name. */
export function participantName(userId: string): string {
  const secret = voiceTokenSecret()
  const digest = secret
    ? crypto.createHmac('sha256', secret).update(`web-test:${userId}`).digest('hex')
    : crypto.createHash('sha256').update(`web-test:${userId}`).digest('hex')
  return `ntv-web-${digest.slice(0, 20)}`
}

/**
 * The SDK server location matching the platform's ElevenLabs environment
 * (ELEVENLABS_API_BASE_URL): a token minted by an isolated EU/IN environment
 * must be used against that environment's WebRTC servers.
 */
export function sdkServerLocation(): 'us' | 'eu-residency' | 'in-residency' {
  const raw = (process.env.ELEVENLABS_API_BASE_URL ?? '').trim()
  const host = URL.canParse(raw) ? new URL(raw).host.toLowerCase() : ''
  if (host === 'api.eu.residency.elevenlabs.io') return 'eu-residency'
  if (host === 'api.in.residency.elevenlabs.io') return 'in-residency'
  return 'us'
}

/** Hashed client IP for the per-IP limit (first X-Forwarded-For hop, as Vercel sets it), or null. */
export function clientIpKey(headers: Headers): string | null {
  const ip = (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || (headers.get('x-real-ip') ?? '').trim()
  if (!ip || ip.length > 64) return null
  return crypto.createHash('sha256').update(`ip:${ip}`).digest('hex').slice(0, 32)
}

export interface WebSessionInput {
  org: { id: string; name: string | null; timezone: string | null; plan: string | null }
  userId: string
  mode: WebTestMode
  /** clientIpKey() of the request (null: no per-IP limit). */
  ipKey: string | null
}

export interface WebSessionResult {
  conversation_token: string
  conversation_id: string | null
  call_id: string | null
  mode: WebTestMode
  connection_type: 'webrtc'
  /** SDK serverLocation (data residency environment of the platform workspace). */
  server_location: 'us' | 'eu-residency' | 'in-residency'
  /** Passed by the browser as the session's dynamic variables (no tokens, no ids). */
  dynamic_variables: Record<string, string>
  /** The panel ends the session after this long. */
  max_session_seconds: number
  /** Browser tests left for an unpaid organisation (null: no lifetime cap). */
  sessions_left: number | null
  /** Seconds of browser tests left in the org's budget (lifetime for unpaid orgs, today for paid ones; null: unknown). */
  seconds_left: number | null
  /** What the business's privacy settings do with this test conversation. */
  privacy: { record_audio: boolean; retention_days: number }
}

export interface WebTestAvailability {
  /** The agent can be tested now (switched on, synced to ElevenLabs). */
  available: boolean
  reason: 'agent_missing' | 'agent_inactive' | 'agent_not_ready' | 'not_configured' | null
  text_available: boolean
  max_session_seconds: number
  /** Unpaid orgs: 0 also when their seconds budget is spent or browser tests are blocked. */
  sessions_left: number | null
  /** Seconds of browser tests left in the org's budget (null: unknown). */
  seconds_left: number | null
  /** Browser tests were blocked after a session far longer than the cap (admin reset needed). */
  blocked: boolean
  privacy: { record_audio: boolean; retention_days: number } | null
}

interface AgentRow {
  id: string
  name: string
  language: string | null
  is_active: boolean | null
  working_hours: unknown
  after_hours: unknown
  conversation_settings: unknown
  privacy_settings: unknown
  metadata: Record<string, unknown> | null
}

interface ResolvedAgent {
  agent: AgentRow
  externalId: string | null
  ready: boolean
  overrides: Set<string>
}

const AGENT_COLUMNS = 'id, name, language, is_active, working_hours, after_hours, conversation_settings, privacy_settings, metadata'

/** The org's agent and its ElevenLabs resource, both scoped by the org id from the session. */
async function resolveAgent(db: SupabaseClient, orgId: string): Promise<ResolvedAgent | null> {
  const { data: agent, error } = await db.from('agents').select(AGENT_COLUMNS).eq('org_id', orgId).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  if (!agent) return null
  const { data: res, error: resErr } = await db
    .from('agent_provider_resources')
    .select('external_id, status, details')
    .eq('org_id', orgId)
    .eq('agent_id', agent.id as string)
    .eq('provider', 'elevenlabs')
    .maybeSingle()
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  const externalId = typeof res?.external_id === 'string' && res.external_id ? res.external_id : null
  // 'degraded' = the config was applied but a platform tool is missing: the
  // agent answers calls, so it can be tested too.
  const ready = !!externalId && (res?.status === 'ready' || res?.status === 'degraded')
  return { agent: agent as AgentRow, externalId, ready, overrides: overridesInForce(res?.details) }
}

/** Same reading as the agent spec (agent-spec.ts): the stored privacy settings, else the legacy record_calls flag. */
function privacyOf(agent: AgentRow) {
  const p = readPrivacySettings(agent.privacy_settings, (agent.metadata?.behavior_settings as Record<string, unknown> | undefined)?.record_calls)
  return { record_audio: p.record_audio, retention_days: p.retention_days }
}

function maxSecondsOf(agent: AgentRow): number {
  const conversation = readConversationSettings(agent.conversation_settings ?? agent.metadata?.behavior_settings)
  return Math.max(60, Math.min(webTestMaxSeconds(), conversation.max_call_duration_minutes * 60))
}

interface UsageRow {
  sessions_started: number
  seconds_total: number
  day_utc: string | null
  day_seconds: number
  blocked_at: string | null
}

/** The org's web_test_usage row (zeros when it has none yet; null when it cannot be read). */
async function readUsage(db: SupabaseClient, orgId: string): Promise<UsageRow | null> {
  const { data, error } = await db.from('web_test_usage').select('sessions_started, seconds_total, day_utc, day_seconds, blocked_at').eq('org_id', orgId).maybeSingle()
  if (error) return null
  const n = (v: unknown) => Math.max(0, Number(v ?? 0) || 0)
  return {
    sessions_started: n(data?.sessions_started),
    seconds_total: n(data?.seconds_total),
    day_utc: typeof data?.day_utc === 'string' ? data.day_utc.slice(0, 10) : null,
    day_seconds: n(data?.day_seconds),
    blocked_at: typeof data?.blocked_at === 'string' && data.blocked_at ? data.blocked_at : null,
  }
}

export interface WebTestBudget {
  blocked: boolean
  /** Lifetime (unpaid) or today's (paid, UTC day) allowance in seconds. */
  limit: number
  window: 'lifetime' | 'day'
  secondsLeft: number
}

/** The org's browser-test seconds budget (pure). */
export function webTestBudget(usage: Pick<UsageRow, 'seconds_total' | 'day_utc' | 'day_seconds' | 'blocked_at'>, paid: boolean, now = Date.now()): WebTestBudget {
  const blocked = !!usage.blocked_at
  if (!paid) {
    const limit = webTestTrialSeconds()
    return { blocked, limit, window: 'lifetime', secondsLeft: Math.max(0, limit - usage.seconds_total) }
  }
  const limit = webTestDailySeconds()
  const today = new Date(now).toISOString().slice(0, 10)
  const used = usage.day_utc === today ? usage.day_seconds : 0
  return { blocked, limit, window: 'day', secondsLeft: Math.max(0, limit - used) }
}

/** Seconds until the next UTC midnight (when a paid org's daily budget starts again). */
function secondsUntilNextUtcDay(now: number): number {
  const d = new Date(now)
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000))
}

/**
 * Refuses a new session when the org's browser tests are blocked or its
 * seconds budget is spent. Unpaid orgs fail closed when the budget cannot be
 * read (every session costs ElevenLabs credits); paid orgs fail open, like
 * the session counter.
 */
async function assertBudget(db: SupabaseClient, orgId: string, paid: boolean, log: Logger, now: number): Promise<WebTestBudget | null> {
  const usage = await readUsage(db, orgId)
  if (!usage) {
    if (!paid) {
      log.error('web_test.budget_read_failed', null)
      throw new RequestError('internal', 'Browser tests are unavailable right now. Please try again later.', 503)
    }
    log.warn('web_test.budget_read_failed')
    return null
  }
  const budget = webTestBudget(usage, paid, now)
  if (budget.blocked) {
    log.warn('web_test.refused_blocked')
    throw new RequestError('forbidden', 'Browser tests are paused for your account. Please contact support to turn them back on.', 403, { reason: 'web_test_blocked' })
  }
  if (budget.secondsLeft >= WEB_TEST_MIN_SESSION_SECONDS) return budget
  if (budget.window === 'lifetime') {
    throw new RequestError('forbidden', 'You have used all your free browser test time. Choose a plan to keep testing your agent.', 403, { reason: 'trial_limit' })
  }
  const retryAfter = secondsUntilNextUtcDay(now)
  throw new RequestError(
    'rate_limited',
    'You have used today\'s browser test time. You can test again tomorrow.',
    429,
    { reason: 'daily_limit', retry_after_seconds: retryAfter },
    { 'Retry-After': String(retryAfter) },
  )
}

/** What the panel may offer (no provider call, nothing counted). */
export async function webTestAvailability(org: WebSessionInput['org'], log: Logger, db: SupabaseClient = createAdminClient()): Promise<WebTestAvailability> {
  const resolved = await resolveAgent(db, org.id)
  const base = { text_available: false, max_session_seconds: webTestMaxSeconds(), sessions_left: null, seconds_left: null, blocked: false, privacy: null }
  if (!resolved) return { ...base, available: false, reason: 'agent_missing' }
  const privacy = privacyOf(resolved.agent)
  let max = maxSecondsOf(resolved.agent)
  const paid = isPaidPlan(org.plan)
  const usage = await readUsage(db, org.id)
  if (!usage) log.warn('web_test.usage_read_failed')
  const budget = usage ? webTestBudget(usage, paid) : null
  const spent = !!budget && (budget.blocked || budget.secondsLeft < WEB_TEST_MIN_SESSION_SECONDS)
  if (budget && !spent) max = Math.min(max, budget.secondsLeft)
  let sessionsLeft: number | null = null
  if (!paid) {
    // The panel shows "no tests left" when the trial's time is spent too.
    sessionsLeft = spent ? 0 : Math.max(0, webTestTrialSessions() - (usage?.sessions_started ?? 0))
  }
  const common = {
    max_session_seconds: max,
    sessions_left: sessionsLeft,
    seconds_left: budget ? budget.secondsLeft : null,
    blocked: budget?.blocked ?? false,
    privacy,
    text_available: resolved.ready && resolved.overrides.has(OVERRIDE_TEXT_ONLY),
  }
  if (!isConfigured()) return { ...common, available: false, reason: 'not_configured', text_available: false }
  if (!resolved.agent.is_active) return { ...common, available: false, reason: 'agent_inactive' }
  if (!resolved.ready) return { ...common, available: false, reason: 'agent_not_ready', text_available: false }
  return { ...common, available: true, reason: null }
}

/**
 * Claims one session of the org's lifetime budget (unpaid orgs) or only
 * counts it (paid orgs). Unpaid orgs fail closed when the counter cannot be
 * used: every session costs ElevenLabs credits.
 */
async function claimSession(db: SupabaseClient, orgId: string, limit: number | null, log: Logger): Promise<{ claimed: boolean; used: number | null }> {
  const { data, error } = await db.rpc('claim_web_test_session', { p_org_id: orgId, p_limit: limit })
  if (error) {
    if (limit !== null) {
      log.error('web_test.claim_failed', new Error(error.message))
      throw new RequestError('internal', 'Browser tests are unavailable right now. Please try again later.', 503)
    }
    log.warn('web_test.count_failed', { error: error.message.slice(0, 200) })
    return { claimed: false, used: null }
  }
  const row = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean; used?: number } | null
  if (!row?.allowed) {
    if (limit !== null) {
      throw new RequestError('forbidden', `You have used all ${limit} free browser tests. Choose a plan to keep testing your agent.`, 403, { reason: 'trial_limit' })
    }
    return { claimed: false, used: null }
  }
  return { claimed: true, used: Number(row.used ?? 0) || 0 }
}

async function releaseSession(db: SupabaseClient, orgId: string, log: Logger): Promise<void> {
  const { error } = await db.rpc('release_web_test_session', { p_org_id: orgId })
  if (error) log.error('web_test.release_failed', new Error(error.message))
}

export async function startWebTestSession(input: WebSessionInput, log: Logger, db: SupabaseClient = createAdminClient()): Promise<WebSessionResult> {
  const orgId = input.org.id
  const resolved = await resolveAgent(db, orgId)
  if (!resolved) throw new RequestError('not_found', 'Set up your agent before testing it.', 404, { reason: 'agent_missing' })
  const { agent } = resolved
  if (!agent.is_active) {
    throw new RequestError('conflict', 'Your agent is switched off. Switch it on to test it.', 409, { reason: 'agent_inactive' })
  }
  if (!resolved.ready || !resolved.externalId) {
    // Never created here: the sync (onboarding, agent page) owns that.
    throw new RequestError('conflict', 'Your agent is still being set up. Try again in a minute.', 409, { reason: 'agent_not_ready' })
  }
  if (input.mode === 'text' && !resolved.overrides.has(OVERRIDE_TEXT_ONLY)) {
    // The agent still carries an older override allow-list (config rollout in progress).
    throw new RequestError('conflict', 'Chat tests are not available for your agent yet. Try a voice test, or try again later.', 409, { reason: 'text_unavailable' })
  }
  if (!isConfigured()) throw new ProviderError({ system: 'elevenlabs', operation: 'conversation.token', code: 'not_configured' })

  const limitMessage = 'You have started many browser tests in a short time. Please wait a few minutes.'
  await enforceRateLimit([RATE_LIMITS.webTest, RATE_LIMITS.webTestDaily], orgId, limitMessage)
  if (input.ipKey) await enforceRateLimit(RATE_LIMITS.webTestIp, input.ipKey, limitMessage)

  const paid = isPaidPlan(input.org.plan)
  const lifetime = paid ? null : webTestTrialSessions()
  if (lifetime === 0 || (!paid && webTestTrialSeconds() === 0)) {
    throw new RequestError('forbidden', 'Browser tests are available on paid plans. Choose a plan to test your agent.', 403, { reason: 'trial_limit' })
  }
  // Server-side seconds budget (the panel's timer is client-side only).
  const budget = await assertBudget(db, orgId, paid, log, Date.now())
  const claim = await claimSession(db, orgId, lifetime, log)

  let token: Awaited<ReturnType<typeof conversationToken>>
  try {
    token = await conversationToken(resolved.externalId, { participantName: participantName(input.userId), ctx: { orgId, agentId: agent.id } })
  } catch (err) {
    // No session started: give the trial session back.
    if (claim.claimed) await releaseSession(db, orgId, log)
    throw err
  }
  const conversationId = token.conversation_id || null

  // Pre-created row: the post-call webhook (or the reconciliation) merges into
  // it by conversation id; is_test keeps it out of billing and automations.
  // Without a conversation id (required by the spec, so not expected) nothing
  // could match it: the webhook's own classification then stores the session
  // as a test call (call-store.ts), with no dangling duplicate here.
  let callId: string | null = null
  if (conversationId) {
    const { data: row, error: insErr } = await db
      .from('calls')
      .insert({
        org_id: orgId,
        agent_id: agent.id,
        direction: 'inbound',
        status: 'in-progress',
        provider: 'elevenlabs',
        primary_provider: 'elevenlabs',
        provider_call_id: conversationId,
        elevenlabs_conversation_id: conversationId,
        routing_reason: 'primary',
        routing: { mode: 'web_test', test_mode: input.mode, source: 'web_session' },
        channel: 'web',
        is_test: true,
        lifecycle_rank: RANK.routed,
        reconcile_attempts: WEB_TEST_RECONCILE_ATTEMPTS_USED,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insErr) {
      // The session still works: an unmatched web conversation is stored as a
      // test call by the webhook's own classification (call-store.ts).
      log.error('web_test.call_row_failed', new Error(insErr.message), { code: insErr.code ?? null })
    } else {
      callId = (row?.id as string | undefined) ?? null
    }
  } else {
    log.warn('web_test.no_conversation_id')
  }

  const language = normalizeAgentLanguage(agent.language)
  const conversation = readConversationSettings(agent.conversation_settings ?? agent.metadata?.behavior_settings)
  const hours = evaluateWorkingHours(readWorkingHours(agent.working_hours), input.org.timezone, readAfterHours(agent.after_hours), new Date())
  const vars = platformVariables({
    callId: null,
    orgId,
    direction: 'inbound',
    routingMode: 'web',
    afterHours: !hours.open,
    businessName: input.org.name ?? '',
    agent: { name: agent.name, language, recordingNotice: conversation.recording_notice, maxDurationSeconds: conversation.max_call_duration_minutes * 60 },
  })
  // Only the values that describe the session: the call id and the token
  // placeholders stay the agent's own ('unknown' / 'none').
  const dynamic_variables: Record<string, string> = {}
  for (const key of [PLATFORM_VARIABLES.routingMode, PLATFORM_VARIABLES.callDirection, PLATFORM_VARIABLES.afterHours, PLATFORM_VARIABLES.businessName]) {
    if (typeof vars[key] === 'string') dynamic_variables[key] = vars[key]
  }

  log.info('web_test.session_started', { agentId: agent.id, callId, mode: input.mode, paid, sessionsUsed: claim.used })
  return {
    conversation_token: token.token,
    conversation_id: conversationId,
    call_id: callId,
    mode: input.mode,
    connection_type: 'webrtc',
    server_location: sdkServerLocation(),
    dynamic_variables,
    // Never longer than the budget left (the budget is still enforced server-side).
    max_session_seconds: budget ? Math.min(maxSecondsOf(agent), budget.secondsLeft) : maxSecondsOf(agent),
    sessions_left: lifetime !== null && claim.used !== null ? Math.max(0, lifetime - claim.used) : null,
    seconds_left: budget ? budget.secondsLeft : null,
    privacy: privacyOf(agent),
  }
}

export interface WebTestSecondsResult {
  /** False when this call was already accounted (webhook retry, reconciliation). */
  recorded: boolean
  totalSeconds: number
  todaySeconds: number
  blocked: boolean
}

/**
 * Accounts the length of one browser test conversation (called by the call
 * store when its post-call data is merged), once per call. A session longer
 * than webTestBlockAfterSeconds() bypassed the panel's cap: the org's browser
 * tests are blocked until a platform admin resets them. Throws on a database
 * error so the webhook (or the reconciliation) retries the accounting.
 */
export async function recordWebTestSeconds(db: SupabaseClient, input: { orgId: string; callId: string; seconds: number }, log: Logger): Promise<WebTestSecondsResult> {
  const seconds = Math.max(0, Math.round(input.seconds))
  const blockAfter = webTestBlockAfterSeconds()
  const { data, error } = await db.rpc('record_web_test_seconds', { p_org_id: input.orgId, p_call_id: input.callId, p_seconds: seconds, p_block_over: blockAfter })
  if (error) throw new Error(`record_web_test_seconds failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as { recorded?: boolean; total_seconds?: number; today_seconds?: number; is_blocked?: boolean; newly_blocked?: boolean } | null
  const result: WebTestSecondsResult = {
    recorded: typeof row === 'object' && row !== null && row.recorded === true,
    totalSeconds: Number(row?.total_seconds ?? 0) || 0,
    todaySeconds: Number(row?.today_seconds ?? 0) || 0,
    blocked: typeof row === 'object' && row !== null && row.is_blocked === true,
  }
  if (typeof row === 'object' && row !== null && row.newly_blocked === true) {
    log.error('web_test.blocked_session_over_limit', null, { orgId: input.orgId, callId: input.callId, seconds, limitSeconds: blockAfter })
  } else if (result.recorded && seconds > blockAfter) {
    log.warn('web_test.session_over_limit', { orgId: input.orgId, callId: input.callId, seconds, limitSeconds: blockAfter })
  }
  if (result.recorded) log.info('web_test.seconds_recorded', { orgId: input.orgId, callId: input.callId, seconds, totalSeconds: result.totalSeconds })
  return result
}

/** Platform admin: lifts the block set by recordWebTestSeconds. True when the org was blocked. */
export async function resetWebTestBlock(orgId: string, log: Logger, db: SupabaseClient = createAdminClient()): Promise<boolean> {
  const { data, error } = await db.rpc('reset_web_test_block', { p_org_id: orgId })
  if (error) throw new Error(`reset_web_test_block failed: ${error.message}`)
  const reset = data === true
  if (reset) log.warn('web_test.block_reset', { orgId })
  return reset
}

/**
 * Maintenance step `web_test_finalize`: browser test rows still in progress
 * two hours after their token was minted, with no provider result (the
 * session never connected, or its webhook was lost and the reconciliation
 * found nothing final). Closed as canceled at rank 40, so a late webhook or
 * poll (rank 50) still fills them in. Never billed, no automations.
 */
export async function finalizeStaleWebTests(limit: number, log: Logger, now = Date.now(), db: SupabaseClient = createAdminClient()) {
  const cutoff = new Date(now - WEB_TEST_FINALIZE_AFTER_MS).toISOString()
  const { data, error } = await db
    .from('calls')
    .select('id, org_id, started_at, created_at')
    .eq('channel', 'web')
    .eq('is_test', true)
    .eq('status', 'in-progress')
    .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`calls web test scan failed: ${error.message}`)
  let finalized = 0
  for (const c of data ?? []) {
    const { data: done, error: updErr } = await db
      .from('calls')
      .update({
        status: 'canceled',
        lifecycle_rank: RANK.finalizedWithoutProvider,
        ended_at: (c.started_at as string | null) ?? (c.created_at as string),
        termination_reason: 'No result was received for this browser test',
      })
      .eq('id', c.id as string)
      .eq('is_test', true)
      .eq('status', 'in-progress')
      .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
      .select('id')
    if (updErr) {
      log.error('web_test.finalize_failed', new Error(updErr.message), { callId: c.id })
      continue
    }
    finalized += done?.length ?? 0
  }
  if (finalized > 0) log.info('web_test.finalized_without_result', { finalized })
  return { scanned: data?.length ?? 0, finalized }
}
