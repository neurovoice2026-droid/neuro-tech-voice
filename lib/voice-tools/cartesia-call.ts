import 'server-only'
// The live Cartesia (fallback) call a webhook tool request belongs to. SIP
// calls into Cartesia cannot carry our signed per-call token, so the call is
// found from the system variables Cartesia fills in (called number, caller
// id; the model cannot change them): the called number gives the
// organisation (our phone_numbers row), then the most recent Cartesia call
// on that number from that caller that has not ended. The request itself is
// authenticated by the bearer secret only Cartesia holds.

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeE164 } from '@/lib/phone/e164'
import { findNumber } from '@/lib/telephony/context'
import { callHasEnded } from './call-context'

/** Fallback calls longer than this are not matched (the per-call duration cap is lower). */
const MATCH_WINDOW_MS = 2 * 3_600_000

export async function findLiveCartesiaCall(db: SupabaseClient, input: { calledNumber: string | null; callerNumber: string | null }, now = Date.now()): Promise<string | null> {
  const called = normalizeE164(input.calledNumber ?? '')
  const caller = normalizeE164(input.callerNumber ?? '')
  if (!called || !caller) return null
  const number = await findNumber(db, called)
  if (!number) return null
  const { data, error } = await db
    .from('calls')
    .select('id, status, ended_at, from_number, to_number')
    .eq('org_id', number.org_id)
    .eq('phone_number_id', number.id)
    .eq('provider', 'cartesia')
    .gte('created_at', new Date(now - MATCH_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(`calls lookup failed: ${error.message}`)
  // Inbound: the caller is the customer; outbound: the router presents the
  // callee as the SIP caller id, so match either side.
  const match = (data ?? []).find(
    (c) => (c.from_number === caller || c.to_number === caller) && !callHasEnded({ status: String(c.status ?? ''), ended_at: (c.ended_at as string | null) ?? null }, now),
  )
  return match ? String(match.id) : null
}
