import 'server-only'
// Cartesia call-event webhooks for Managed Agents are officially "coming
// soon", so results are also pulled: after a Cartesia leg ends (dial-complete)
// and from the maintenance job for calls still missing data. Matching uses
// the call id we pass in the SIP header when Cartesia echoes it, otherwise
// (agent, called number, caller number, start time ± 3 min).

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import * as ct from '@/lib/cartesia/client'
import { normalizeCartesiaCall } from '@/lib/cartesia/webhook'
import { applyCallEvent, recordUsage } from './call-store'
import { RANK } from './call-merge'

const WINDOW_MS = 3 * 60_000

export async function pollCartesiaCall(callId: string, log: Logger = createLogger()): Promise<'applied' | 'not_found' | 'pending' | 'duplicate'> {
  const db = createAdminClient()
  const { data: call, error } = await db
    .from('calls')
    .select('id, org_id, agent_id, cartesia_call_id, from_number, to_number, direction, started_at, created_at, lifecycle_rank, routing')
    .eq('id', callId)
    .maybeSingle()
  if (error) throw new Error(`calls read failed: ${error.message}`)
  if (!call?.agent_id) return 'not_found'

  const { data: res, error: resErr } = await db
    .from('agent_provider_resources')
    .select('external_id')
    .eq('agent_id', call.agent_id)
    .eq('provider', 'cartesia')
    .maybeSingle()
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  if (!res?.external_id) return 'not_found'

  let remote: ct.CartesiaCall | null = null
  if (call.cartesia_call_id) {
    remote = await ct.calls.get(call.cartesia_call_id as string)
  } else {
    const startedMs = Date.parse((call.started_at ?? call.created_at) as string)
    const list = await ct.calls.list({
      agent_id: res.external_id as string,
      start_time_gte: new Date(startedMs - WINDOW_MS).toISOString(),
      start_time_lte: new Date(startedMs + WINDOW_MS).toISOString(),
      limit: 20,
    })
    const ours = call.direction === 'outbound' ? call.from_number : call.to_number
    const theirs = call.direction === 'outbound' ? call.to_number : call.from_number
    const candidates = (list.data ?? []).filter((c) => {
      const tp = c.telephony_params ?? {}
      const header = tp.headers?.['x-ntv-call-id'] ?? tp.headers?.['X-NTV-Call-Id']
      if (header) return header === callId
      return (!tp.to || tp.to === ours) && (!tp.from || tp.from === theirs)
    })
    // Closest start time wins when several calls match.
    candidates.sort((a, b) => Math.abs(Date.parse(a.start_time ?? '') - startedMs) - Math.abs(Date.parse(b.start_time ?? '') - startedMs))
    remote = candidates[0] ?? null
  }
  if (!remote) return 'not_found'
  if (remote.status === 'created' || remote.status === 'started') return 'pending'

  const event = normalizeCartesiaCall(remote as ct.CartesiaCall & Record<string, unknown>)
  if (!event) return 'pending'
  // Another row already holds this Cartesia call (created from a webhook
  // before this row could be matched): that row carries the data and the
  // billing; this one must not be billed again.
  const { data: holder, error: holderErr } = await db.from('calls').select('id').eq('cartesia_call_id', remote.id).neq('id', callId).limit(1)
  if (holderErr) throw new Error(`calls duplicate lookup failed: ${holderErr.message}`)
  if (holder?.length) {
    log.warn('cartesia_poll.held_by_other_row', { callId, otherCallId: holder[0].id })
    return 'duplicate'
  }
  await applyCallEvent({ ...event, localCallId: callId, localCallIdTrusted: true }, log)
  return 'applied'
}

const TWILIO_TERMINAL = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled'])

/**
 * Maintenance: Cartesia-served calls that connected but have no provider data
 * yet. After 30 minutes without provider data (and once the leg has ended),
 * the call is billed from the Twilio leg duration so usage is never lost (the
 * ledger still bills once) and finalized at rank 40 so the scan moves on; a
 * late provider result (rank 50) still upgrades it. Calls whose Cartesia leg
 * never connected (status failed) are not polled.
 */
export async function reconcileCartesiaCalls(limit = 25, log: Logger = createLogger({ component: 'cartesia_poll' })) {
  const db = createAdminClient()
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data: calls, error } = await db
    .from('calls')
    .select('id, org_id, status, created_at, routing, usage_recorded_at, duration_seconds')
    .eq('provider', 'cartesia')
    .in('status', ['in-progress', 'completed'])
    .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`calls scan failed: ${error.message}`)
  const counts: Record<string, number> = {}
  for (const c of calls ?? []) {
    let r: 'applied' | 'not_found' | 'pending' | 'duplicate' | 'error'
    try {
      r = await pollCartesiaCall(c.id as string, log)
    } catch (err) {
      // Keep going: after 30 minutes the call is billed from Twilio's leg
      // duration even if Cartesia cannot be queried (outage, missing call).
      r = 'error'
      log.error('cartesia_poll.call_failed', err, { callId: c.id })
    }
    counts[r] = (counts[r] ?? 0) + 1
    try {
      const ageMs = Date.now() - Date.parse(c.created_at as string)
      const routing = (c.routing ?? {}) as { cartesia_dial?: { duration?: number }; twilio_duration?: number; twilio_status?: string }
      const legEnded = !!routing.cartesia_dial || TWILIO_TERMINAL.has(routing.twilio_status ?? '')
      if (r === 'applied' || (r !== 'duplicate' && (!legEnded || ageMs <= 30 * 60_000))) continue
      const seconds = routing.cartesia_dial?.duration ?? routing.twilio_duration ?? 0
      if (r !== 'duplicate' && seconds > 0 && !c.usage_recorded_at) {
        await recordUsage(db, { orgId: c.org_id as string, callId: c.id as string, seconds, provider: 'cartesia', source: 'twilio_dial_duration' }, log)
      }
      const { error: finErr } = await db
        .from('calls')
        .update({
          lifecycle_rank: RANK.finalizedWithoutProvider,
          status: seconds > 0 ? 'completed' : c.status,
          ...(c.duration_seconds ? {} : { duration_seconds: seconds }),
        })
        .eq('id', c.id)
        .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
      if (finErr) log.error('cartesia_poll.finalize_failed', finErr, { callId: c.id })
      else log.warn('cartesia_poll.finalized_without_provider_data', { callId: c.id, seconds })
      counts.finalized = (counts.finalized ?? 0) + 1
    } catch (err) {
      counts.error = (counts.error ?? 0) + 1
      log.error('cartesia_poll.finalize_step_failed', err, { callId: c.id })
    }
  }
  return counts
}
