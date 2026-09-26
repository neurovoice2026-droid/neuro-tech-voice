import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio/sms'
import { isE164 } from '@/lib/phone/e164'
import { waitlistOfferSms } from '@/lib/sms/templates'
import { servicesMatch } from '@/lib/scheduling/text'

// Waitlist: callers who wanted a time that wasn't free. When a booking is
// cancelled or moved, the freed time is offered by text to the longest
// waiting caller whose service fits. The offer invites them to call back
// (no link, no automatic booking), so two people can't be promised one slot
// by the system: whoever calls first books it through the normal checks.

/** Don't offer a slot that starts too soon for anyone to act on the text. */
const MIN_OFFER_LEAD_MS = 60 * 60_000
const MAX_OFFER_ATTEMPTS = 3

export interface AddToWaitlistInput {
  orgId: string
  agentId: string | null
  callId: string | null
  callerName: string | null
  callerPhone: string | null
  service: string | null
  preferredTimes: string | null
}

export type AddToWaitlistResult =
  | { ok: true; entryId: string; alreadyWaiting: boolean }
  | { ok: false; reason: 'no_phone' | 'storage_error' }

/** Adds a caller, or updates their existing entry for the same service. */
export async function addToWaitlist(input: AddToWaitlistInput): Promise<AddToWaitlistResult> {
  if (!input.callerPhone || !isE164(input.callerPhone)) return { ok: false, reason: 'no_phone' }
  const admin = createAdminClient()

  const existing = await admin
    .from('waitlist_entries')
    .select('id, service, caller_name, preferred_times')
    .eq('org_id', input.orgId)
    .eq('caller_phone', input.callerPhone)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(10)
  if (existing.error) {
    console.error('[scheduling] waitlist lookup failed', existing.error.code, existing.error.message)
    return { ok: false, reason: 'storage_error' }
  }
  const same = (existing.data ?? []).find(
    (entry) => (entry.service ?? null) === input.service || (!!entry.service && !!input.service && servicesMatch(entry.service, input.service))
  )
  if (same) {
    const { error } = await admin
      .from('waitlist_entries')
      .update({
        caller_name: input.callerName ?? same.caller_name ?? null,
        preferred_times: input.preferredTimes ?? same.preferred_times ?? null,
        call_id: input.callId,
      })
      .eq('id', same.id)
      .eq('org_id', input.orgId)
    if (error) {
      console.error('[scheduling] waitlist update failed', error.code, error.message)
      return { ok: false, reason: 'storage_error' }
    }
    return { ok: true, entryId: same.id as string, alreadyWaiting: true }
  }

  const { data, error } = await admin
    .from('waitlist_entries')
    .insert({
      org_id: input.orgId,
      agent_id: input.agentId,
      call_id: input.callId,
      caller_name: input.callerName,
      caller_phone: input.callerPhone,
      service: input.service,
      preferred_times: input.preferredTimes,
      status: 'waiting',
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[scheduling] waitlist insert failed', error?.code, error?.message)
    return { ok: false, reason: 'storage_error' }
  }
  return { ok: true, entryId: data.id as string, alreadyWaiting: false }
}

export interface OfferFreedSlotInput {
  orgId: string
  startsAt: string
  service: string | null
  timezone: string
  language: string
  businessName: string | null
  /** The caller who freed the slot: never offered their own time back. */
  excludePhone: string | null
  now?: Date
}

/**
 * Texts the freed time to the first matching waiting caller. Never throws;
 * returns whether someone was offered the slot.
 */
export async function offerFreedSlot(input: OfferFreedSlotInput): Promise<{ offered: boolean; entryId: string | null }> {
  const none = { offered: false, entryId: null }
  try {
    const now = input.now ?? new Date()
    const startsAt = Date.parse(input.startsAt)
    if (!Number.isFinite(startsAt) || startsAt - now.getTime() < MIN_OFFER_LEAD_MS) return none

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('waitlist_entries')
      .select('id, caller_phone, service')
      .eq('org_id', input.orgId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(50)
    if (error) {
      console.error('[scheduling] waitlist lookup failed', error.code, error.message)
      return none
    }

    const candidates = (data ?? []).filter(
      (entry) =>
        typeof entry.caller_phone === 'string' &&
        entry.caller_phone !== input.excludePhone &&
        servicesMatch(entry.service as string | null, input.service)
    )
    const body = waitlistOfferSms({
      language: input.language,
      businessName: input.businessName,
      startsAt: input.startsAt,
      timezone: input.timezone,
      service: input.service,
    })

    for (const entry of candidates.slice(0, MAX_OFFER_ATTEMPTS)) {
      // Claim first so a parallel cancellation can't text the same person twice.
      const claim = await admin
        .from('waitlist_entries')
        .update({ status: 'offered', offered_at: now.toISOString() })
        .eq('id', entry.id)
        .eq('org_id', input.orgId)
        .eq('status', 'waiting')
        .select('id')
      if (claim.error || !claim.data?.length) continue

      const sent = await sendSms({ orgId: input.orgId, to: entry.caller_phone as string, body, kind: 'waitlist_offer' })
      if (sent.ok) return { offered: true, entryId: entry.id as string }

      await admin
        .from('waitlist_entries')
        .update({ status: 'waiting', offered_at: null })
        .eq('id', entry.id)
        .eq('org_id', input.orgId)
      // Texts are off for the whole org: nobody else can be reached either.
      if (sent.reason === 'not_configured' || sent.reason === 'sms_disabled' || sent.reason === 'no_sms_number') {
        console.warn('[scheduling] waitlist offer not sent', { orgId: input.orgId, reason: sent.reason })
        return none
      }
      console.warn('[scheduling] waitlist offer failed for one entry', { orgId: input.orgId, reason: sent.reason })
    }
    return none
  } catch (error) {
    console.error('[scheduling] waitlist offer failed', error instanceof Error ? error.message : error)
    return none
  }
}
