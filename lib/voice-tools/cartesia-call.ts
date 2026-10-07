import 'server-only'
// The live Cartesia (fallback) call a webhook tool request belongs to.
//
// SIP calls into Cartesia cannot carry our signed per-call token, and
// Cartesia exposes neither our SIP header (x-ntv-call-id) nor a call id we
// stored to the tool request, so the call is found from the two numbers in
// the request body: called_number and caller_number, bound in the tool
// definition to the system variables system__called_number and
// system__caller_id (lib/cartesia/agent-config.ts), the same way
// get_call_context identifies the call. The request itself is authenticated
// by the bearer secret only Cartesia holds (CARTESIA_TOOL_SECRET).
//
// Because those body fields are not signed, the match is strict:
//   • the called number is one of our lines (phone_numbers row → the org);
//   • the call row is a Cartesia call on THAT line of THAT org, started
//     within the last MATCH_WINDOW_MS;
//   • it is in progress (or ended within the short grace of a tool request
//     racing the hang-up);
//   • BOTH numbers match the stored call: inbound = caller → our line;
//     outbound = our line → callee (the router presents the callee as the
//     SIP caller id).
// Residual risk (documented in docs/voice-providers.md): if Cartesia let the
// model fill a dynamic_variable-bound field, a fallback agent could name
// another live Cartesia call by its two numbers. That needs both numbers of a
// call in progress right now on that line, and only adds a message to that
// call (alerting that call's own business); nothing is read back.

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeE164 } from '@/lib/phone/e164'
import { findNumber } from '@/lib/telephony/context'
import { callHasEnded } from './call-context'

/** Fallback calls are only matched this long after they started (a message later in a longer call is taken by voice). */
export const MATCH_WINDOW_MS = 60 * 60_000

type CandidateRow = { id: string; status: string | null; ended_at: string | null; direction: string | null; from_number: string | null; to_number: string | null }

/** Both numbers of the request are the two ends of the stored call, in the call's own direction. */
function numbersMatch(c: CandidateRow, called: string, caller: string): boolean {
  return c.direction === 'outbound' ? c.from_number === called && c.to_number === caller : c.to_number === called && c.from_number === caller
}

/** Connected to the fallback agent and not over (a tool request racing the hang-up is still served). */
function isLive(c: CandidateRow, now: number): boolean {
  if (callHasEnded({ status: String(c.status ?? ''), ended_at: c.ended_at ?? null }, now)) return false
  return c.status === 'in-progress' || !!c.ended_at
}

export async function findLiveCartesiaCall(db: SupabaseClient, input: { calledNumber: string | null; callerNumber: string | null }, now = Date.now()): Promise<string | null> {
  const called = normalizeE164(input.calledNumber ?? '')
  const caller = normalizeE164(input.callerNumber ?? '')
  if (!called || !caller || called === caller) return null
  const number = await findNumber(db, called)
  if (!number || number.number !== called) return null
  const { data, error } = await db
    .from('calls')
    .select('id, status, ended_at, direction, from_number, to_number')
    .eq('org_id', number.org_id)
    .eq('phone_number_id', number.id)
    .eq('provider', 'cartesia')
    .gte('created_at', new Date(now - MATCH_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(`calls lookup failed: ${error.message}`)
  const match = ((data ?? []) as CandidateRow[]).find((c) => numbersMatch(c, called, caller) && isLive(c, now))
  return match ? String(match.id) : null
}
