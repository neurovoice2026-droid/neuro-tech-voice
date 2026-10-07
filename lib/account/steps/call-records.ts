import 'server-only'
// Provider copies of the organization's calls: ElevenLabs conversations
// (transcript and audio), Cartesia calls, and the Twilio call and message
// records (caller numbers, text bodies).
//
// collect_call_records runs while the agents still exist and writes one
// account_deletion_items row per provider record:
//   • from the organization's own calls rows (stored conversation, call and
//     CallSid ids) and sms_messages rows (message SIDs), keyset-paginated;
//   • from GET /v1/convai/conversations?agent_id=<the org's verified agent>
//     (cursor, page_size 100) and the Cartesia call list of its fallback
//     agent: conversations that never got a row (web tests, lost webhooks).
//     Every listed item is checked against the agent id we asked for.
// delete_call_records (after the agents are deleted) deletes the items in
// bounded, concurrent batches. 404 counts as deleted; an item that keeps
// failing is retried with its own backoff and given up on after
// ITEM_MAX_ATTEMPTS (counted). Both steps resume where they stopped.
// A Twilio call is a tree: before a parent CallSid is deleted, its child
// calls (Twilio calls.list({parentCallSid}): <Dial> legs for forwarding,
// human transfer, whisper and the Cartesia SIP leg, native transfers) are
// added as items of their own, and so deleted (and their own children
// listed) in the same loop. If the listing fails the parent is kept and
// retried, so its children can still be found.

import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { CONVERSATIONS_MAX_PAGE_SIZE, listConversations } from '@/lib/elevenlabs/api/conversations'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import { isProviderError } from '@/lib/voice-providers/errors'
import { providerTargets, type CallRow } from '@/lib/calls/serialize'
import type { StepOutcome } from '../deletion-plan'
import { RetryLaterError, type StepContext } from '../job'
import { agentCursors, loadOrgAgents, providerConfigured, verifyOrgAgents } from './agents'
import { chunks, countOf, forEachLimited, isGone, isNotConfigured } from './util'

export type ItemKind = 'elevenlabs_conversation' | 'cartesia_call' | 'twilio_call' | 'twilio_message'
export type ItemOutcome = 'deleted' | 'already_gone' | 'skipped_not_configured' | 'invalid' | 'gave_up'

const PAGE = 1000
const INSERT_CHUNK = 500
const DELETE_BATCH = 40
const CONCURRENCY = 4
export const ITEM_MAX_ATTEMPTS = 5
/** Hard stop for a runaway cursor: 1,000 pages of 100 conversations per agent. */
const MAX_EL_PAGES = 1000
/** Cartesia only serves the fallback: 50 pages of 100 calls per agent. */
const MAX_CT_PAGES = 50

const ID_FORMAT: Record<ItemKind, RegExp> = {
  elevenlabs_conversation: /^[A-Za-z0-9_-]{1,128}$/,
  cartesia_call: /^[A-Za-z0-9_-]{1,128}$/,
  twilio_call: /^CA[0-9a-f]{32}$/i,
  twilio_message: /^(SM|MM)[0-9a-f]{32}$/i,
}

interface ItemRow {
  kind: ItemKind
  resource_id: string
  attempts: number
}

async function addItems(ctx: StepContext, items: Array<{ kind: ItemKind; resource_id: string }>): Promise<void> {
  const unique = new Map(items.filter((i) => i.resource_id).map((i) => [`${i.kind}:${i.resource_id}`, i]))
  for (const part of chunks([...unique.values()], INSERT_CHUNK)) {
    const { error } = await ctx.db
      .from('account_deletion_items')
      .upsert(part.map((i) => ({ deletion_id: ctx.jobId, kind: i.kind, resource_id: i.resource_id, attempts: 0, next_attempt_at: new Date(ctx.now()).toISOString() })), {
        onConflict: 'deletion_id,kind,resource_id',
        ignoreDuplicates: true,
      })
    if (error) throw new Error(`account_deletion_items insert failed: ${error.message}`)
  }
}

/** calls rows → provider ids (keyset pagination on id). Returns false when it stopped at the deadline. */
async function collectFromCalls(ctx: StepContext): Promise<boolean> {
  while (!ctx.state.calls_collected) {
    if (ctx.now() >= ctx.deadline) return false
    let q = ctx.db
      .from('calls')
      .select('id, provider, provider_call_id, elevenlabs_conversation_id, cartesia_call_id, twilio_call_sid')
      .eq('org_id', ctx.orgId)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (ctx.state.calls_after) q = q.gt('id', ctx.state.calls_after)
    const { data, error } = await q
    if (error) throw new Error(`calls read failed: ${error.message}`)
    const rows = (data ?? []) as Array<Pick<CallRow, 'id' | 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id' | 'cartesia_call_id'> & { twilio_call_sid: string | null }>
    const items: Array<{ kind: ItemKind; resource_id: string }> = []
    for (const row of rows) {
      for (const t of providerTargets(row)) items.push({ kind: t.provider === 'elevenlabs' ? 'elevenlabs_conversation' : 'cartesia_call', resource_id: t.externalId })
      if (row.twilio_call_sid) items.push({ kind: 'twilio_call', resource_id: row.twilio_call_sid })
    }
    await addItems(ctx, items)
    if (rows.length) ctx.state.calls_after = rows[rows.length - 1].id
    if (rows.length < PAGE) ctx.state.calls_collected = true
  }
  return true
}

async function collectFromSms(ctx: StepContext): Promise<boolean> {
  while (!ctx.state.sms_collected) {
    if (ctx.now() >= ctx.deadline) return false
    let q = ctx.db.from('sms_messages').select('id, twilio_sid').eq('org_id', ctx.orgId).order('id', { ascending: true }).limit(PAGE)
    if (ctx.state.sms_after) q = q.gt('id', ctx.state.sms_after)
    const { data, error } = await q
    if (error) throw new Error(`sms_messages read failed: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: string; twilio_sid: string | null }>
    await addItems(ctx, rows.filter((r) => r.twilio_sid).map((r) => ({ kind: 'twilio_message' as const, resource_id: r.twilio_sid as string })))
    if (rows.length) ctx.state.sms_after = rows[rows.length - 1].id
    if (rows.length < PAGE) ctx.state.sms_collected = true
  }
  return true
}

/** Lists the conversations of each verified ElevenLabs agent, resuming from the stored cursor. */
async function collectElevenLabsListing(ctx: StepContext, counts: Record<string, number>): Promise<boolean> {
  for (const [agentId, cursor] of Object.entries(agentCursors(ctx, 'elevenlabs'))) {
    if (cursor.verdict !== 'ours' || cursor.listed) continue
    while (!cursor.listed) {
      if (ctx.now() >= ctx.deadline) return false
      if ((cursor.pages ?? 0) >= MAX_EL_PAGES) {
        cursor.listed = true
        counts.listing_truncated = (counts.listing_truncated ?? 0) + 1
        ctx.log.error('account_deletion.conversation_listing_truncated', undefined, { pages: cursor.pages })
        break
      }
      const page = await listConversations({ agentId, cursor: cursor.cursor ?? null, pageSize: CONVERSATIONS_MAX_PAGE_SIZE }, { orgId: ctx.orgId })
      const mine = (page.conversations ?? []).filter((c) => c.agent_id === agentId)
      if (mine.length !== (page.conversations ?? []).length) ctx.log.error('account_deletion.listing_foreign_items_dropped', undefined, { dropped: (page.conversations ?? []).length - mine.length })
      await addItems(ctx, mine.map((c) => ({ kind: 'elevenlabs_conversation' as const, resource_id: c.conversation_id })))
      cursor.pages = (cursor.pages ?? 0) + 1
      cursor.cursor = page.next_cursor ?? null
      if (!page.has_more || !page.next_cursor) cursor.listed = true
    }
  }
  return true
}

async function collectCartesiaListing(ctx: StepContext, counts: Record<string, number>): Promise<boolean> {
  for (const [agentId, cursor] of Object.entries(agentCursors(ctx, 'cartesia'))) {
    if (cursor.verdict !== 'ours' || cursor.listed) continue
    while (!cursor.listed) {
      if (ctx.now() >= ctx.deadline) return false
      if ((cursor.pages ?? 0) >= MAX_CT_PAGES) {
        cursor.listed = true
        counts.listing_truncated = (counts.listing_truncated ?? 0) + 1
        ctx.log.error('account_deletion.cartesia_listing_truncated', undefined, { pages: cursor.pages })
        break
      }
      const page = await ct.calls.list({ agent_id: agentId, limit: 100, starting_after: cursor.cursor ?? null })
      const data = page.data ?? []
      const mine = data.filter((c) => c.agent_id === agentId)
      await addItems(ctx, mine.map((c) => ({ kind: 'cartesia_call' as const, resource_id: c.id })))
      cursor.pages = (cursor.pages ?? 0) + 1
      cursor.cursor = data.length ? data[data.length - 1].id : null
      if (!page.has_more || !data.length) cursor.listed = true
    }
  }
  return true
}

/** Child calls listed per parent (a call has a handful of legs at most). */
const CHILD_CALLS_LIMIT = 100

/**
 * CallSids whose ParentCallSid is `parentSid`: the <Dial> legs (forwarding,
 * human transfer, whisper, the Cartesia SIP leg) and native transfer legs,
 * separate call records (numbers, timing) that deleting the parent leaves.
 */
async function childCallSids(parentSid: string): Promise<string[]> {
  const children = await getTwilioClient().calls.list({ parentCallSid: parentSid, limit: CHILD_CALLS_LIMIT })
  return children.map((c) => c.sid).filter((sid) => typeof sid === 'string' && sid !== parentSid && ID_FORMAT.twilio_call.test(sid))
}

async function itemCount(ctx: StepContext, filter?: { outcome?: ItemOutcome; pending?: boolean }): Promise<number> {
  let q = ctx.db.from('account_deletion_items').select('resource_id', { count: 'exact', head: true }).eq('deletion_id', ctx.jobId)
  if (filter?.outcome) q = q.eq('outcome', filter.outcome)
  if (filter?.pending) q = q.is('done_at', null)
  return countOf(q, 'account_deletion_items')
}

export async function collectCallRecords(ctx: StepContext): Promise<StepOutcome> {
  const counts: Record<string, number> = {}
  if (!(await collectFromCalls(ctx))) return { status: 'more' }
  if (!(await collectFromSms(ctx))) return { status: 'more' }
  if (!ctx.state.agents_verified) {
    const verify = await verifyOrgAgents(ctx, await loadOrgAgents(ctx))
    if (verify.notConfigured) {
      counts.listing_not_configured = verify.notConfigured
      ctx.log.error('account_deletion.provider_not_configured', undefined, { area: 'conversation_listing', agents: verify.notConfigured })
    }
    ctx.state.agents_verified = true
  }
  if (providerConfigured('elevenlabs') && !(await collectElevenLabsListing(ctx, counts))) return { status: 'more', counts }
  if (providerConfigured('cartesia') && !(await collectCartesiaListing(ctx, counts))) return { status: 'more', counts }
  counts.records = await itemCount(ctx)
  return { status: 'done', counts }
}

async function deleteAtProvider(ctx: StepContext, item: ItemRow): Promise<ItemOutcome> {
  const reqCtx = { orgId: ctx.orgId }
  switch (item.kind) {
    case 'elevenlabs_conversation':
      if (!el.isConfigured()) return 'skipped_not_configured'
      await el.conversations.delete(item.resource_id, reqCtx)
      return 'deleted'
    case 'cartesia_call':
      if (!ct.isConfigured()) return 'skipped_not_configured'
      await ct.calls.delete(item.resource_id, reqCtx)
      return 'deleted'
    case 'twilio_call': {
      if (!isTwilioConfigured()) return 'skipped_not_configured'
      // Children are listed (and queued) while the parent record still exists.
      const children = await childCallSids(item.resource_id)
      if (children.length) await addItems(ctx, children.map((sid) => ({ kind: 'twilio_call' as const, resource_id: sid })))
      await getTwilioClient().calls(item.resource_id).remove()
      return 'deleted'
    }
    case 'twilio_message':
      if (!isTwilioConfigured()) return 'skipped_not_configured'
      await getTwilioClient().messages(item.resource_id).remove()
      return 'deleted'
  }
}

async function processItem(ctx: StepContext, item: ItemRow): Promise<void> {
  let outcome: ItemOutcome | null = null
  let lastError: string | null = null
  if (!ID_FORMAT[item.kind].test(item.resource_id)) outcome = 'invalid'
  else {
    try {
      outcome = await deleteAtProvider(ctx, item)
    } catch (err) {
      if (isGone(err)) outcome = 'already_gone'
      else if (isNotConfigured(err)) outcome = 'skipped_not_configured'
      else lastError = errorCode(err)
    }
  }
  const attempts = (Number.isFinite(Number(item.attempts)) ? Number(item.attempts) : 0) + 1
  const nowMs = ctx.now()
  let patch: Record<string, unknown>
  if (outcome) {
    patch = { outcome, done_at: new Date(nowMs).toISOString(), attempts, last_error: null }
  } else if (attempts >= ITEM_MAX_ATTEMPTS) {
    patch = { outcome: 'gave_up', done_at: new Date(nowMs).toISOString(), attempts, last_error: lastError }
    ctx.log.error('account_deletion.call_record_gave_up', undefined, { kind: item.kind, code: lastError })
  } else {
    patch = { attempts, last_error: lastError, next_attempt_at: new Date(nowMs + Math.min(30, 2 ** attempts) * 60_000).toISOString() }
  }
  const { error } = await ctx.db
    .from('account_deletion_items')
    .update(patch)
    .eq('deletion_id', ctx.jobId)
    .eq('kind', item.kind)
    .eq('resource_id', item.resource_id)
  if (error) throw new Error(`account_deletion_items update failed: ${error.message}`)
}

/** A short code for an item failure (never the provider's message). */
function errorCode(err: unknown): string {
  if (isProviderError(err)) return `${err.system}:${err.code}`
  const e = err as { status?: unknown; code?: unknown } | null
  if (e && typeof e === 'object' && (typeof e.status === 'number' || typeof e.code === 'number')) return `twilio:${String(e.status ?? '')}:${String(e.code ?? '')}`.slice(0, 60)
  return 'error'
}

export async function deleteCallRecords(ctx: StepContext): Promise<StepOutcome> {
  for (;;) {
    if (ctx.now() >= ctx.deadline) return { status: 'more' }
    const { data, error } = await ctx.db
      .from('account_deletion_items')
      .select('kind, resource_id, attempts')
      .eq('deletion_id', ctx.jobId)
      .is('done_at', null)
      .lte('next_attempt_at', new Date(ctx.now()).toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(DELETE_BATCH)
    if (error) throw new Error(`account_deletion_items read failed: ${error.message}`)
    const batch = (data ?? []) as ItemRow[]
    if (!batch.length) break
    await forEachLimited(batch, CONCURRENCY, (item) => processItem(ctx, item), ctx.deadline, ctx.now)
  }
  const pending = await itemCount(ctx, { pending: true })
  if (pending) throw new RetryLaterError(`${pending} provider call record(s) will be retried`)
  const counts: Record<string, number> = {}
  for (const outcome of ['deleted', 'already_gone', 'skipped_not_configured', 'invalid', 'gave_up'] as const) {
    counts[outcome] = await itemCount(ctx, { outcome })
  }
  if (counts.skipped_not_configured) ctx.log.error('account_deletion.provider_not_configured', undefined, { area: 'call_records', records: counts.skipped_not_configured })
  return { status: 'done', counts }
}
