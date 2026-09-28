import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env, isElevenLabsConfigured, isGatewayConfigured, isStripeConfigured, isTwilioConfigured } from '@/lib/env'
import { isE164 } from '@/lib/phone/e164'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import { getStripeClient } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTwilioClient, isTwilioNotFound, numberCapabilities, twilioErrorInfo } from '@/lib/twilio/client'
import type { PhoneNumberView } from '@/lib/twilio/types'
import { numberWebhookUrls } from '@/lib/twilio/webhooks'
import type { PhoneNumber } from '@/types'

// Owning a number means the app router owns its Twilio webhooks: voice,
// voice fallback, status callback and SMS all point at /api/telephony/*.
// Numbers bought before the migration were imported into ElevenLabs, which
// had rewritten the voice URL to its own servers; configureNumberRouting
// removes that import and takes the number back.

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io'

export type RoutingStatus = 'connected' | 'needs_reconnect'

type PhoneRow = Partial<PhoneNumber> & { id: string; org_id: string; number: string }

/** The org's oldest active number: the caller id for calls the app places. */
export async function activeOrgNumber(supabase: SupabaseClient, orgId: string): Promise<{ id: string; number: string } | null> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('id, number')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[telephony] active number lookup failed', error.code, error.message)
    throw new Error('Phone number lookup failed')
  }
  return (data as { id: string; number: string } | null) ?? null
}

/**
 * Whether the app router has any voice pipeline to hand calls to. Without the
 * gateway and without the ElevenLabs fallback, a reconnected number would only
 * ever play the apology, so reconnecting (which removes a working legacy
 * ElevenLabs import) is refused until one of them is configured.
 */
export function isVoiceRoutingReady(): boolean {
  return isGatewayConfigured() || isElevenLabsConfigured()
}

/** Whether a stored row is routed through the app with the current public URL. */
export function routingStatusFor(row: Pick<PhoneNumber, 'routing_mode' | 'voice_url' | 'routing_error'>): RoutingStatus {
  const expected = numberWebhookUrls().voiceUrl
  if (row.routing_mode === 'app_router' && row.voice_url === expected && !row.routing_error) return 'connected'
  return 'needs_reconnect'
}

const VIEW_COLUMNS =
  'id, number, friendly_name, country, is_active, agent_id, sms_capable, routing_mode, voice_url, routing_error, routing_synced_at, monthly_cost, elevenlabs_phone_number_id, created_at, agents(name)'
// Before migration 010 the routing columns don't exist; such numbers show as needing a reconnect.
const LEGACY_VIEW_COLUMNS =
  'id, number, friendly_name, country, is_active, agent_id, monthly_cost, elevenlabs_phone_number_id, created_at, agents(name)'

type ViewRow = Partial<PhoneNumber> & {
  id: string
  number: string
  created_at: string
  agents?: { name: string | null } | { name: string | null }[] | null
}

export function toPhoneNumberView(row: ViewRow): PhoneNumberView {
  const agent = Array.isArray(row.agents) ? row.agents[0] : row.agents
  const cost = row.monthly_cost === null || row.monthly_cost === undefined ? null : Number(row.monthly_cost)
  return {
    id: row.id,
    number: row.number,
    friendly_name: row.friendly_name ?? null,
    country: row.country ?? null,
    is_active: row.is_active ?? false,
    agent_id: row.agent_id ?? null,
    agent_name: agent?.name ?? null,
    sms_capable: row.sms_capable ?? false,
    routing_status: routingStatusFor({
      routing_mode: row.routing_mode ?? null,
      voice_url: row.voice_url ?? null,
      routing_error: row.routing_error ?? null,
    }),
    legacy_import:
      row.routing_mode === 'elevenlabs_import' || (row.routing_mode !== 'app_router' && !!row.elevenlabs_phone_number_id),
    routing_error: row.routing_error ?? null,
    routing_synced_at: row.routing_synced_at ?? null,
    monthly_cost: Number.isFinite(cost) ? cost : null,
    created_at: row.created_at,
  }
}

/** The org's numbers for the dashboard, newest first. Works with the session client (SELECT own). */
export async function listPhoneNumbersForOrg(supabase: SupabaseClient, orgId: string): Promise<PhoneNumberView[]> {
  const query = (columns: string) =>
    supabase.from('phone_numbers').select(columns).eq('org_id', orgId).order('created_at', { ascending: false })
  let { data, error } = await query(VIEW_COLUMNS)
  if (error?.code === '42703') ({ data, error } = await query(LEGACY_VIEW_COLUMNS))
  if (error) {
    console.error('[telephony] phone number list failed', error.code, error.message)
    throw new Error('Phone number list failed')
  }
  return ((data ?? []) as unknown as ViewRow[]).map(toPhoneNumberView)
}

/** One number of the org as the dashboard shows it, or null. */
export async function getPhoneNumberView(supabase: SupabaseClient, orgId: string, phoneNumberId: string): Promise<PhoneNumberView | null> {
  const query = (columns: string) =>
    supabase.from('phone_numbers').select(columns).eq('org_id', orgId).eq('id', phoneNumberId).maybeSingle()
  let { data, error } = await query(VIEW_COLUMNS)
  if (error?.code === '42703') ({ data, error } = await query(LEGACY_VIEW_COLUMNS))
  if (error) {
    console.error('[telephony] phone number lookup failed', error.code, error.message)
    throw new Error('Phone number lookup failed')
  }
  return data ? toPhoneNumberView(data as unknown as ViewRow) : null
}

/** Short, owner-readable reason; the raw Twilio message only goes to the server log. */
function friendlyTwilioError(error: unknown, action: string): string {
  const info = twilioErrorInfo(error)
  console.error('[telephony]', action, 'failed', info.status, info.code, info.message)
  if (info.status === 401 || info.code === 20003) return 'Our phone provider rejected the account credentials.'
  if (isTwilioNotFound(error)) return 'This number no longer exists in the phone provider account.'
  if (info.status === 429) return 'The phone provider is busy right now. Please try again in a minute.'
  return 'The phone provider could not update this number. Please try again.'
}

async function loadRow(phoneNumberId: string): Promise<PhoneRow | null> {
  const { data, error } = await createAdminClient()
    .from('phone_numbers')
    // select('*'): the column set differs before and after migration 010.
    .select('*')
    .eq('id', phoneNumberId)
    .maybeSingle()
  if (error) {
    console.error('[telephony] phone number lookup failed', error.code, error.message)
    throw new Error('Phone number lookup failed')
  }
  return (data as PhoneRow | null) ?? null
}

/**
 * Removes a legacy ElevenLabs native import. 404 means it is already gone.
 * Direct fetch on purpose: this is the only ElevenLabs phone call the app
 * still makes, and it must never re-import.
 */
export async function deleteLegacyElevenLabsImport(elevenLabsPhoneNumberId: string): Promise<{ ok: boolean }> {
  const apiKey = env.ELEVENLABS_API_KEY
  if (!isElevenLabsConfigured() || !apiKey) {
    console.warn('[telephony] cannot remove the legacy ElevenLabs phone import: ELEVENLABS_API_KEY is not configured')
    return { ok: false }
  }
  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/phone-numbers/${encodeURIComponent(elevenLabsPhoneNumberId)}`,
      { method: 'DELETE', headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(10_000), cache: 'no-store' }
    )
    if (res.ok || res.status === 404) return { ok: true }
    console.error('[telephony] ElevenLabs phone import delete failed', res.status)
    return { ok: false }
  } catch (error) {
    console.error('[telephony] ElevenLabs phone import delete failed', error instanceof Error ? error.message : error)
    return { ok: false }
  }
}

async function storeRoutingError(phoneNumberId: string, orgId: string, message: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('phone_numbers')
    .update({ routing_error: message })
    .eq('id', phoneNumberId)
    .eq('org_id', orgId)
  if (error) console.error('[telephony] could not store routing_error', error.code, error.message)
}

/**
 * Points the Twilio number at the app router and records the result on the
 * row (routing_mode, voice_url, sms_capable, routing_synced_at, routing_error).
 */
export async function configureNumberRouting(phoneNumberId: string): Promise<{ ok: boolean; error?: string }> {
  const row = await loadRow(phoneNumberId)
  if (!row) return { ok: false, error: 'Phone number not found.' }
  if (!isTwilioConfigured()) return { ok: false, error: 'Phone service is not configured yet.' }
  if (!row.twilio_sid) {
    const message = 'This number has no phone provider record, so it cannot be connected.'
    await storeRoutingError(row.id, row.org_id, message)
    return { ok: false, error: message }
  }

  let legacyRemoved = false
  if (row.elevenlabs_phone_number_id) {
    legacyRemoved = (await deleteLegacyElevenLabsImport(row.elevenlabs_phone_number_id)).ok
    // Not fatal: once Twilio points at us, the stale import no longer receives calls.
  }

  const urls = numberWebhookUrls()
  const client = getTwilioClient()
  let capabilitiesSms = false
  try {
    const current = await client.incomingPhoneNumbers(row.twilio_sid).fetch()
    await client.incomingPhoneNumbers(row.twilio_sid).update({
      voiceUrl: urls.voiceUrl,
      voiceMethod: 'POST',
      voiceFallbackUrl: urls.voiceFallbackUrl,
      voiceFallbackMethod: 'POST',
      statusCallback: urls.statusCallback,
      statusCallbackMethod: 'POST',
      smsUrl: urls.smsUrl,
      smsMethod: 'POST',
      // An application or SIP trunk on the number overrides the URLs above.
      ...(current.voiceApplicationSid ? { voiceApplicationSid: '' } : {}),
      ...(current.smsApplicationSid ? { smsApplicationSid: '' } : {}),
      ...(current.trunkSid ? { trunkSid: '' } : {}),
    })
    const after = await client.incomingPhoneNumbers(row.twilio_sid).fetch()
    const mismatch =
      after.voiceUrl !== urls.voiceUrl ||
      after.voiceMethod?.toUpperCase() !== 'POST' ||
      after.voiceFallbackUrl !== urls.voiceFallbackUrl ||
      after.statusCallback !== urls.statusCallback ||
      after.smsUrl !== urls.smsUrl ||
      !!after.voiceApplicationSid ||
      !!after.trunkSid
    if (mismatch) {
      console.error('[telephony] number routing did not stick', row.twilio_sid)
      const message = 'The phone provider did not keep the new settings. Please try again.'
      await storeRoutingError(row.id, row.org_id, message)
      return { ok: false, error: message }
    }
    capabilitiesSms = numberCapabilities(after.capabilities).sms
  } catch (error) {
    const message = friendlyTwilioError(error, 'configure number routing')
    await storeRoutingError(row.id, row.org_id, message)
    return { ok: false, error: message }
  }

  const update: Record<string, unknown> = {
    routing_mode: 'app_router',
    voice_url: urls.voiceUrl,
    sms_capable: capabilitiesSms,
    routing_synced_at: new Date().toISOString(),
    routing_error: null,
  }
  if (legacyRemoved) update.elevenlabs_phone_number_id = null
  const { error } = await createAdminClient()
    .from('phone_numbers')
    .update(update)
    .eq('id', row.id)
    .eq('org_id', row.org_id)
  if (error) {
    console.error('[telephony] routing state update failed', error.code, error.message)
    return { ok: false, error: 'The number was connected, but we could not save its status. Please try again.' }
  }
  return { ok: true }
}

export interface ProvisionPhoneNumberInput {
  orgId: string
  number: string
  country: string
  agentId?: string | null
  stripeSubscriptionId: string | null
}

async function resolveAgentId(orgId: string, agentId: string | null | undefined): Promise<string | null> {
  const supabase = createAdminClient()
  if (agentId) {
    const { data } = await supabase.from('agents').select('id').eq('id', agentId).eq('org_id', orgId).maybeSingle()
    if (data) return (data as { id: string }).id
  }
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Buys a number (after payment) with the app router's webhooks set at
 * creation and records it. Idempotent: a number the org already has returns
 * its row, and a number the Twilio account already owns (an earlier attempt
 * that failed after buying) is reconfigured instead of bought twice. Never
 * imports into ElevenLabs. Throws when it can't finish; the billing webhook
 * refunds in that case.
 */
export async function provisionPhoneNumber(input: ProvisionPhoneNumberInput): Promise<{ id: string }> {
  if (!isE164(input.number)) throw new Error('provisionPhoneNumber needs an E.164 number')
  const supabase = createAdminClient()

  const { data: existing, error: existingError } = await supabase
    .from('phone_numbers')
    .select('id, org_id')
    .eq('number', input.number)
    .maybeSingle()
  if (existingError) throw new Error(`Phone number lookup failed: ${existingError.message}`)
  if (existing) {
    const row = existing as { id: string; org_id: string }
    if (row.org_id === input.orgId) return { id: row.id }
    throw new Error('This number already belongs to another organization')
  }

  const client = getTwilioClient()
  const urls = numberWebhookUrls()
  const webhookSettings = {
    voiceUrl: urls.voiceUrl,
    voiceMethod: 'POST',
    voiceFallbackUrl: urls.voiceFallbackUrl,
    voiceFallbackMethod: 'POST',
    statusCallback: urls.statusCallback,
    statusCallbackMethod: 'POST',
    smsUrl: urls.smsUrl,
    smsMethod: 'POST',
  }

  // The phoneNumber filter also matches partial numbers, so compare exactly.
  const owned = (await client.incomingPhoneNumbers.list({ phoneNumber: input.number, limit: 20 })).find(
    (n) => n.phoneNumber === input.number
  )
  const purchased = owned
    ? await client.incomingPhoneNumbers(owned.sid).update(webhookSettings)
    : await client.incomingPhoneNumbers.create({ phoneNumber: input.number, ...webhookSettings })
  const boughtNow = !owned

  const agentId = await resolveAgentId(input.orgId, input.agentId)
  const now = new Date().toISOString()
  const { data: inserted, error: insertError } = await supabase
    .from('phone_numbers')
    .insert({
      org_id: input.orgId,
      twilio_sid: purchased.sid,
      number: purchased.phoneNumber,
      friendly_name: purchased.friendlyName ?? null,
      country: input.country,
      is_active: true,
      is_verified: true,
      agent_id: agentId,
      monthly_cost: PHONE_NUMBER_MONTHLY_PRICE_USD,
      stripe_subscription_id: input.stripeSubscriptionId,
      routing_mode: 'app_router',
      voice_url: urls.voiceUrl,
      sms_capable: numberCapabilities(purchased.capabilities).sms,
      routing_synced_at: now,
      routing_error: null,
    })
    .select('id')
    .single()

  if (!insertError && inserted) return { id: (inserted as { id: string }).id }

  // A concurrent delivery of the same webhook won the insert.
  if (insertError?.code === '23505') {
    const { data: raced } = await supabase
      .from('phone_numbers')
      .select('id, org_id')
      .eq('number', purchased.phoneNumber)
      .maybeSingle()
    const row = raced as { id: string; org_id: string } | null
    if (row && row.org_id === input.orgId) return { id: row.id }
  }

  console.error('[telephony] phone number insert failed after purchase', insertError?.code, insertError?.message)
  // The payment is refunded by the caller, so don't keep paying for the number.
  if (boughtNow) {
    try {
      await client.incomingPhoneNumbers(purchased.sid).remove()
    } catch (error) {
      const info = twilioErrorInfo(error)
      console.error('[telephony] could not release the number after a failed insert', purchased.sid, info.code, info.message)
    }
  }
  throw new Error(`Could not save the purchased number: ${insertError?.message ?? 'unknown error'}`)
}

export type ReleasePhoneNumberResult =
  | { ok: true; billingWarning: string | null }
  | { ok: false; code: 'not_found' | 'not_configured' | 'provider_error' | 'database_error'; error: string }

/**
 * Gives a number back: Twilio first (so we stop paying for it), then the
 * legacy ElevenLabs import, the number's Stripe subscription and the row.
 * If Twilio refuses, nothing else changes, so a retry is always safe.
 */
export async function releasePhoneNumber(input: {
  phoneNumberId: string
  orgId: string
  /** False when Stripe already cancelled the subscription (customer.subscription.deleted). */
  cancelSubscription: boolean
}): Promise<ReleasePhoneNumberResult> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('id', input.phoneNumberId)
    .eq('org_id', input.orgId)
    .maybeSingle()
  if (error) {
    console.error('[telephony] release lookup failed', error.code, error.message)
    return { ok: false, code: 'database_error', error: 'We could not load this number. Please try again.' }
  }
  const row = data as PhoneRow | null
  if (!row) return { ok: false, code: 'not_found', error: 'Phone number not found.' }

  if (row.twilio_sid) {
    if (!isTwilioConfigured()) {
      return { ok: false, code: 'not_configured', error: 'Phone service is not configured, so the number cannot be released yet.' }
    }
    try {
      await getTwilioClient().incomingPhoneNumbers(row.twilio_sid).remove()
    } catch (err) {
      if (!isTwilioNotFound(err)) {
        return { ok: false, code: 'provider_error', error: friendlyTwilioError(err, 'release number') }
      }
    }
  }

  if (row.elevenlabs_phone_number_id) {
    await deleteLegacyElevenLabsImport(row.elevenlabs_phone_number_id)
  }

  let billingWarning: string | null = null
  const subscriptionId = row.stripe_subscription_id ?? null
  if (input.cancelSubscription && subscriptionId) {
    if (!isStripeConfigured()) {
      console.error('[telephony] cannot cancel phone number subscription: Stripe is not configured', row.id)
      billingWarning = 'The number was released, but its monthly charge could not be stopped automatically. Please cancel it from Billing.'
    } else {
      try {
        await getStripeClient().subscriptions.cancel(subscriptionId)
      } catch (err) {
        const code = (err as { code?: string } | null)?.code
        if (code !== 'resource_missing') {
          console.error('[telephony] phone number subscription cancel failed', row.id, code ?? (err instanceof Error ? err.message : err))
          billingWarning = 'The number was released, but its monthly charge could not be stopped automatically. Please cancel it from Billing.'
        }
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('phone_numbers')
    .delete()
    .eq('id', row.id)
    .eq('org_id', input.orgId)
  if (deleteError) {
    console.error('[telephony] phone number row delete failed', deleteError.code, deleteError.message)
    return { ok: false, code: 'database_error', error: 'The number was released, but we could not remove it from your list. Please refresh.' }
  }
  return { ok: true, billingWarning }
}
