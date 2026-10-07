import 'server-only'
// Lost-webhook recovery for calls served by ElevenLabs (maintenance step
// `conversation_reconcile`). A post-call webhook can be lost (delivery
// retries off or exhausted, endpoint down, webhook auto-disabled). Without
// this step an app-routed call ends with no transcript or analysis, a native
// outbound call stays 'ringing' forever, and a native inbound call never
// appears at all.
//
//   1. Rows: ElevenLabs calls without a final provider result (rank < 50)
//      that ended (Twilio terminal status, or created more than 20 minutes
//      ago). With a stored conversation id → GET it; otherwise list the
//      org's OWN agent's conversations filtered on the dynamic variable
//      ntv_call_id (= calls.id) around the call's start, then GET.
//   2. Native inbound sweep: agents with an active native number; their
//      conversations since a stored watermark, oldest first, that no calls
//      row and no processed webhook already holds.
// A conversation is applied only once it is final (done | failed) and only
// after its agent_id matched the org's own agent, through the SAME merge path
// as the webhook (applyCallEvent, source 'poll'). Billing stays exactly once:
// usage_ledger key call:<id>. Every run is bounded (rows, GETs, agents) and
// stops while the ElevenLabs API circuit is not closed.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { isConfigured } from '@/lib/elevenlabs/client'
import {
  FINAL_CONVERSATION_STATUSES,
  dynamicVariable,
  findConversationsByCallId,
  getConversation,
  listConversations,
  type ELConversationDetails,
  type ELConversationListItem,
} from '@/lib/elevenlabs/api/conversations'
import { normalizeElevenLabsEvent, readEnvelope } from '@/lib/elevenlabs/webhook'
import { applyCallEvent } from './call-store'
import { RANK } from './call-merge'
import { peek } from './circuit-registry'
import { isProviderError } from './errors'
import { readWatermarks, writeWatermark } from './maintenance-state'

const SWEEP_KEY_PREFIX = 'conversation_sweep:'

const MINUTE = 60_000
/** A call is considered ended this long after it was created (no Twilio status needed). */
export const ENDED_AFTER_MS = 20 * MINUTE
/** A row is re-checked at most this often. */
const RECHECK_MS = 15 * MINUTE
/** Attempts per row before it is left to stale-calls (Twilio duration) or settled. */
export const MAX_ATTEMPTS = 6
const MAX_AGE_MS = 7 * 24 * 60 * MINUTE
/** Native outbound rows with no conversation after this long are settled as failed. */
const SETTLE_RINGING_AFTER_MS = 2 * 60 * MINUTE
/** Native inbound sweep: never look further back than this. */
const SWEEP_MAX_LOOKBACK_MS = 24 * 60 * MINUTE
/** A conversation still running after this long no longer holds the sweep watermark. */
const SWEEP_STUCK_AFTER_MS = 3 * 60 * MINUTE
const TWILIO_TERMINAL = ['completed', 'busy', 'failed', 'no-answer', 'canceled']
const WEB_SOURCES = new Set([
  'android_sdk', 'node_js_sdk', 'react_native_sdk', 'react_sdk', 'js_sdk', 'python_sdk', 'swift_sdk', 'flutter_sdk', 'widget', 'template_preview',
])

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= min && v <= max ? v : fallback
}

/** Rows checked per run (ELEVENLABS_RECONCILE_BATCH, 0–100, default 20; 0 turns the row pass off). */
export const reconcileBatch = () => envInt('ELEVENLABS_RECONCILE_BATCH', 20, 0, 100)
/** Agents swept for native inbound calls per run (ELEVENLABS_RECONCILE_SWEEP_AGENTS, 0–50, default 5). */
export const sweepAgents = () => envInt('ELEVENLABS_RECONCILE_SWEEP_AGENTS', 5, 0, 50)
/** Conversation GETs per run across both passes (ELEVENLABS_RECONCILE_MAX_FETCHES, 1–200, default 40). */
export const maxFetches = () => envInt('ELEVENLABS_RECONCILE_MAX_FETCHES', 40, 1, 200)

interface ReconcileRow {
  id: string
  org_id: string
  agent_id: string | null
  status: string
  lifecycle_rank: number
  elevenlabs_conversation_id: string | null
  provider_call_id: string | null
  routing: Record<string, unknown> | null
  created_at: string
  started_at: string | null
  reconcile_attempts: number | null
}

export interface ReconcileReport {
  skipped?: 'not_configured' | 'circuit_open'
  scanned: number
  applied: number
  pending: number
  notFound: number
  settled: number
  errors: number
  swept: { agents: number; listed: number; applied: number; errors: number }
  fetches: number
}

type AgentRef = { orgId: string; externalId: string } | null

/** The org's own ElevenLabs agent id for a local agent (cached per run). */
async function agentRefFor(db: SupabaseClient, agentId: string | null, cache: Map<string, AgentRef>): Promise<AgentRef> {
  if (!agentId) return null
  if (cache.has(agentId)) return cache.get(agentId) ?? null
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('org_id, external_id')
    .eq('agent_id', agentId)
    .eq('provider', 'elevenlabs')
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  const ref = data?.external_id ? { orgId: data.org_id as string, externalId: data.external_id as string } : null
  cache.set(agentId, ref)
  return ref
}

/** The org that owns an ElevenLabs agent id (null when none does). */
async function orgOfExternalAgent(db: SupabaseClient, externalAgentId: string): Promise<string | null> {
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('org_id')
    .eq('provider', 'elevenlabs')
    .eq('external_id', externalAgentId)
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  return (data?.org_id as string | undefined) ?? null
}

/** post_call_transcription-equivalent event for a fetched conversation. */
export function eventFromConversation(details: ELConversationDetails) {
  return normalizeElevenLabsEvent(readEnvelope({ type: 'post_call_transcription', data: details }))
}

function isNativeOutboundRinging(row: ReconcileRow): boolean {
  return row.status === 'ringing' && !(row.routing && typeof row.routing.twilio_status === 'string')
}

export async function reconcileElevenLabsConversations(
  opts: { limit?: number; log?: Logger; now?: number; sweep?: boolean } = {},
): Promise<ReconcileReport> {
  const log = (opts.log ?? createLogger()).child({ component: 'conversation_reconcile' })
  const now = opts.now ?? Date.now()
  const report: ReconcileReport = { scanned: 0, applied: 0, pending: 0, notFound: 0, settled: 0, errors: 0, swept: { agents: 0, listed: 0, applied: 0, errors: 0 }, fetches: 0 }
  if (!isConfigured()) return { ...report, skipped: 'not_configured' }
  if ((await peek('elevenlabs', now)).state !== 'closed') return { ...report, skipped: 'circuit_open' }

  const db = createAdminClient()
  const budget = { fetches: maxFetches() }
  const agents = new Map<string, AgentRef>()
  const limit = opts.limit ?? reconcileBatch()

  if (limit > 0) {
    const iso = (ms: number) => new Date(ms).toISOString()
    const { data, error } = await db
      .from('calls')
      .select('id, org_id, agent_id, status, lifecycle_rank, elevenlabs_conversation_id, provider_call_id, routing, created_at, started_at, reconcile_attempts')
      .eq('provider', 'elevenlabs')
      .lt('lifecycle_rank', RANK.completed)
      .lt('reconcile_attempts', MAX_ATTEMPTS)
      .gte('created_at', iso(now - MAX_AGE_MS))
      .lt('created_at', iso(now - 2 * MINUTE))
      .or(`reconcile_checked_at.is.null,reconcile_checked_at.lt."${iso(now - RECHECK_MS)}"`)
      .order('reconcile_checked_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
      .limit(limit * 3)
    if (error) throw new Error(`calls reconcile scan failed: ${error.message}`)
    const ended = ((data ?? []) as ReconcileRow[]).filter((r) => {
      const twilio = r.routing && typeof r.routing.twilio_status === 'string' ? (r.routing.twilio_status as string) : null
      return (twilio !== null && TWILIO_TERMINAL.includes(twilio)) || now - Date.parse(r.created_at) >= ENDED_AFTER_MS
    })
    for (const row of ended.slice(0, limit)) {
      if (budget.fetches <= 0) break
      report.scanned++
      try {
        const result = await reconcileRow(db, row, agents, budget, log, now)
        report[result]++
      } catch (err) {
        report.errors++
        log.error('conversation_reconcile.row_failed', err, { callId: row.id, orgId: row.org_id })
        await markChecked(db, row, now, log)
      }
    }
  }

  if (opts.sweep !== false && sweepAgents() > 0 && budget.fetches > 0) {
    try {
      await sweepNativeInbound(db, agents, budget, report, log, now)
    } catch (err) {
      report.swept.errors++
      log.error('conversation_reconcile.sweep_failed', err)
    }
  }
  report.fetches = maxFetches() - budget.fetches
  if (report.applied > 0 || report.swept.applied > 0) {
    // Recovered calls mean post-call webhooks are being lost: worth a look.
    log.warn('conversation_reconcile.recovered_without_webhook', { rows: report.applied, native: report.swept.applied })
  }
  return report
}

async function markChecked(db: SupabaseClient, row: ReconcileRow, now: number, log: Logger) {
  const { error } = await db
    .from('calls')
    .update({ reconcile_checked_at: new Date(now).toISOString(), reconcile_attempts: Math.min(100, (row.reconcile_attempts ?? 0) + 1) })
    .eq('id', row.id)
    .lt('lifecycle_rank', RANK.completed)
  if (error) log.error('conversation_reconcile.mark_failed', new Error(error.message), { callId: row.id })
}

async function reconcileRow(
  db: SupabaseClient,
  row: ReconcileRow,
  agents: Map<string, AgentRef>,
  budget: { fetches: number },
  log: Logger,
  now: number,
): Promise<'applied' | 'pending' | 'notFound' | 'settled'> {
  const l = log.child({ callId: row.id, orgId: row.org_id })
  const ref = await agentRefFor(db, row.agent_id, agents)
  const ctx = { orgId: row.org_id, callId: row.id }
  let details: ELConversationDetails | null = null
  const knownId = row.elevenlabs_conversation_id ?? row.provider_call_id

  if (knownId) {
    budget.fetches--
    try {
      details = await getConversation(knownId, ctx)
    } catch (err) {
      if (!(isProviderError(err) && err.code === 'not_found')) throw err
      details = null
    }
    // Never apply another tenant's conversation (a corrupted id, a reused row):
    // its agent must be the row's agent, or at least an agent of the row's org.
    if (details && !(ref ? details.agent_id === ref.externalId : (await orgOfExternalAgent(db, details.agent_id)) === row.org_id)) {
      l.error('conversation_reconcile.agent_mismatch', null, { conversationAgent: details.agent_id })
      await markChecked(db, row, now, log)
      return 'notFound'
    }
  } else if (ref && ref.orgId === row.org_id) {
    const createdS = Math.floor(Date.parse(row.started_at ?? row.created_at) / 1000)
    budget.fetches -= 3 // one listing + up to two GETs
    const found = await findConversationsByCallId(ref.externalId, row.id, {
      callStartAfterUnix: createdS - 300,
      callStartBeforeUnix: createdS + 6 * 3600,
      ctx,
      max: 2,
    })
    details = found.find((d) => FINAL_CONVERSATION_STATUSES.has(d.status)) ?? found[0] ?? null
  }

  if (details && FINAL_CONVERSATION_STATUSES.has(details.status)) {
    const event = eventFromConversation(details)
    if (!event) throw new Error('conversation could not be normalized')
    // Verified above: fetched by this row's own conversation id, or found on
    // the org's own agent with ntv_call_id = this row's id.
    const echoed = dynamicVariable(details, 'ntv_call_id')
    if (knownId || (echoed && echoed.toLowerCase() === row.id.toLowerCase())) {
      event.localCallId = row.id
      event.localCallIdTrusted = true
    }
    const res = await applyCallEvent(event, l, { source: 'poll' })
    l.warn('conversation_reconcile.applied', { outcome: res.outcome, status: details.status })
    return 'applied'
  }
  if (details) {
    // Still running or processing: look again later.
    await markChecked(db, row, now, log)
    return 'pending'
  }

  // No conversation at the provider.
  if (isNativeOutboundRinging(row) && now - Date.parse(row.created_at) >= SETTLE_RINGING_AFTER_MS) {
    const { error } = await db
      .from('calls')
      .update({
        status: 'failed',
        lifecycle_rank: RANK.failedToStart,
        termination_reason: 'No conversation was found at the voice provider',
        ended_at: row.started_at ?? row.created_at,
        reconcile_checked_at: new Date(now).toISOString(),
        reconcile_attempts: Math.min(100, (row.reconcile_attempts ?? 0) + 1),
      })
      .eq('id', row.id)
      .eq('status', 'ringing')
      .lt('lifecycle_rank', RANK.failedToStart)
    if (error) throw new Error(`calls settle failed: ${error.message}`)
    l.warn('conversation_reconcile.ringing_settled')
    return 'settled'
  }
  // App-routed calls without a conversation are billed from Twilio's
  // duration by stale-calls.ts once they are old enough.
  await markChecked(db, row, now, log)
  return 'notFound'
}

/** Native inbound calls have no row until their webhook: sweep the agent's conversation list. */
async function sweepNativeInbound(
  db: SupabaseClient,
  agents: Map<string, AgentRef>,
  budget: { fetches: number },
  report: ReconcileReport,
  log: Logger,
  now: number,
) {
  const { data: numbers, error } = await db
    .from('phone_numbers')
    .select('agent_id')
    .eq('routing_mode', 'native_elevenlabs')
    .eq('is_active', true)
    .not('agent_id', 'is', null)
    .limit(1000)
  if (error) throw new Error(`phone_numbers scan failed: ${error.message}`)
  const agentIds = [...new Set((numbers ?? []).map((n) => n.agent_id as string))]
  if (agentIds.length === 0) return
  const watermarks = await readWatermarks(SWEEP_KEY_PREFIX, log, db)
  // Least recently swept first.
  const marks = agentIds.map((id) => ({ id, at: watermarks.get(`${SWEEP_KEY_PREFIX}${id}`) ?? null }))
  marks.sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  for (const { id: agentId, at } of marks.slice(0, sweepAgents())) {
    if (budget.fetches <= 0) break
    const ref = await agentRefFor(db, agentId, agents)
    if (!ref) continue
    report.swept.agents++
    try {
      await sweepAgent(db, agentId, ref, at, budget, report, log, now)
    } catch (err) {
      report.swept.errors++
      log.error('conversation_reconcile.sweep_agent_failed', err, { agentId, orgId: ref.orgId })
    }
  }
}

async function sweepAgent(
  db: SupabaseClient,
  agentId: string,
  ref: { orgId: string; externalId: string },
  watermark: number | null,
  budget: { fetches: number },
  report: ReconcileReport,
  log: Logger,
  now: number,
) {
  const from = Math.max(watermark ?? now - SWEEP_MAX_LOOKBACK_MS, now - SWEEP_MAX_LOOKBACK_MS)
  const until = now - 5 * MINUTE
  const ctx = { orgId: ref.orgId, agentId }
  const listed: ELConversationListItem[] = []
  let cursor: string | null = null
  for (let page = 0; page < 2; page++) {
    budget.fetches--
    const res = await listConversations(
      { agentId: ref.externalId, callStartAfterUnix: Math.floor(from / 1000), callStartBeforeUnix: Math.floor(until / 1000), cursor, pageSize: 100, sortDirection: 'asc' },
      ctx,
    )
    listed.push(...(res.conversations ?? []).filter((c) => c.agent_id === ref.externalId))
    cursor = res.has_more ? (res.next_cursor ?? null) : null
    if (!cursor || budget.fetches <= 0) break
  }
  report.swept.listed += listed.length
  listed.sort((a, b) => a.start_time_unix_secs - b.start_time_unix_secs)

  const ids = listed.map((c) => c.conversation_id)
  const known = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const [rows, events] = await Promise.all([
      db.from('calls').select('elevenlabs_conversation_id').in('elevenlabs_conversation_id', chunk),
      db.from('webhook_events').select('external_id').eq('provider', 'elevenlabs').eq('event_type', 'post_call_transcription').in('external_id', chunk).in('status', ['processed', 'ignored']),
    ])
    if (rows.error) throw new Error(`calls lookup failed: ${rows.error.message}`)
    if (events.error) throw new Error(`webhook_events lookup failed: ${events.error.message}`)
    for (const r of rows.data ?? []) known.add(r.elevenlabs_conversation_id as string)
    for (const r of events.data ?? []) known.add(r.external_id as string)
  }

  // The watermark only moves past conversations that are settled here.
  let advanceTo = listed.length > 0 && !cursor ? until : (listed.at(-1)?.start_time_unix_secs ?? Math.floor(until / 1000)) * 1000
  for (const c of listed) {
    const startMs = c.start_time_unix_secs * 1000
    if (known.has(c.conversation_id)) continue
    // Browser/SDK/dashboard sessions are never billed: not worth a fetch.
    if (c.conversation_initiation_source && WEB_SOURCES.has(c.conversation_initiation_source)) continue
    if (!FINAL_CONVERSATION_STATUSES.has(c.status)) {
      if (now - startMs < SWEEP_STUCK_AFTER_MS) advanceTo = Math.min(advanceTo, startMs - 1000)
      continue
    }
    if (budget.fetches <= 0) {
      advanceTo = Math.min(advanceTo, startMs - 1000)
      break
    }
    budget.fetches--
    const details = await getConversation(c.conversation_id, ctx)
    if (details.agent_id !== ref.externalId || !FINAL_CONVERSATION_STATUSES.has(details.status)) continue
    const event = eventFromConversation(details)
    if (!event) continue
    const res = await applyCallEvent(event, log.child({ agentId, orgId: ref.orgId }), { source: 'poll' })
    if (res.outcome === 'created' || res.outcome === 'updated') report.swept.applied++
  }
  await writeWatermark(`${SWEEP_KEY_PREFIX}${agentId}`, Math.max(from, advanceTo), log, db)
}
