import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTwilioClient } from '@/lib/twilio/client'
import { publicBaseUrl } from '@/lib/voice-providers/config'
import { ingressUrls, applyNumberRouting } from '@/lib/telephony/binding'
import { syncAgent } from '@/lib/voice-providers/agent-sync'
import { createLogger } from '@/lib/observability/logger'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'

export interface ProvisionPhoneNumberParams {
  orgId: string
  number: string
  country?: string
  agentId?: string | null
  stripeSubscriptionId?: string | null
}

/**
 * Buys a number from Twilio, records it, and binds it in `app_routed` mode
 * (our ingress decides each call: ElevenLabs primary, Cartesia fallback,
 * after-hours gate). Called only after payment is confirmed (Stripe webhook).
 *
 * Idempotent: Stripe retries webhooks, so a number already recorded for this
 * org is returned as-is instead of being bought (and billed) twice.
 */
/** ≤64 chars (Twilio friendlyName limit); identifies one paid checkout. */
function purchaseMarker(orgId: string, stripeSubscriptionId: string | null): string | null {
  if (!stripeSubscriptionId) return null
  return `ntv:${crypto.createHash('sha256').update(`${orgId}:${stripeSubscriptionId}`).digest('hex').slice(0, 32)}`
}

export async function provisionPhoneNumber(
  supabase: SupabaseClient,
  { orgId, number, country, agentId, stripeSubscriptionId }: ProvisionPhoneNumberParams
) {
  const log = createLogger({ component: 'provision', orgId })
  const e164 = normalizeE164(number)
  if (!e164) throw new Error('invalid phone number')

  const { data: existing, error: existingErr } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('number', e164)
    .maybeSingle()
  if (existingErr) throw new Error(existingErr.message)
  if (existing) {
    if (existing.org_id !== orgId) throw new Error('number already belongs to another organization')
    log.info('provision.already_provisioned', { number: maskPhone(e164) })
    return existing
  }

  // agent_id comes from checkout metadata: only accept an agent of this org.
  let localAgentId: string | null = null
  if (agentId) {
    const { data: owned, error: ownErr } = await supabase.from('agents').select('id').eq('id', agentId).eq('org_id', orgId).maybeSingle()
    if (ownErr) throw new Error(ownErr.message)
    localAgentId = (owned?.id as string | undefined) ?? null
  }
  if (!localAgentId) {
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (agentErr) throw new Error(agentErr.message)
    localAgentId = agent?.id ?? null
  }

  // Step 1: buy the number with our ingress already configured on it. The
  // friendly name carries a marker of THIS purchase, so a retry after a
  // failure between the purchase and the DB insert can adopt the number it
  // bought — and nothing else the Twilio account owns (another deployment's
  // number, an operator line) can ever be taken over by a paying tenant.
  const base = publicBaseUrl()
  const webhooks = base ? { ...ingressUrls(base), voiceMethod: 'POST', voiceFallbackMethod: 'POST', statusCallbackMethod: 'POST' } : {}
  const marker = purchaseMarker(orgId, stripeSubscriptionId ?? null)
  const twilio = getTwilioClient()
  const [alreadyOwned] = await twilio.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 })
  if (alreadyOwned && (!marker || alreadyOwned.friendlyName !== marker)) {
    log.error('provision.number_owned_elsewhere', null, { number: maskPhone(e164) })
    throw new Error('number is already owned by the platform account and not linked to this purchase')
  }
  const purchased = alreadyOwned
    ? await twilio.incomingPhoneNumbers(alreadyOwned.sid).update(webhooks)
    : await twilio.incomingPhoneNumbers.create({ phoneNumber: e164, ...(marker ? { friendlyName: marker } : {}), ...webhooks })
  if (alreadyOwned) log.warn('provision.adopted_own_purchase', { number: maskPhone(e164) })

  // Step 2: record it.
  const { data: phoneRecord, error: dbError } = await supabase
    .from('phone_numbers')
    .insert({
      org_id: orgId,
      twilio_sid: purchased.sid,
      number: purchased.phoneNumber,
      friendly_name: purchased.friendlyName,
      country: country ?? 'US',
      is_active: true,
      is_verified: true,
      agent_id: localAgentId,
      stripe_subscription_id: stripeSubscriptionId ?? null,
      routing_mode: 'app_routed',
      routing_status: 'pending',
      supports_inbound: purchased.capabilities?.voice !== false,
      supports_outbound: purchased.capabilities?.voice !== false,
    })
    .select()
    .single()
  if (dbError) throw new Error(dbError.message)

  // Step 3: telephony audio format on the agent (μ-law for app routing) and
  // the Cartesia SIP import for the fallback. Failures are recorded on the
  // number/agent status and retried by maintenance; the purchase stands.
  if (localAgentId) {
    try {
      await syncAgent(localAgentId, { log })
    } catch (err) {
      log.error('provision.agent_sync_failed', err)
    }
  }
  try {
    await applyNumberRouting(phoneRecord.id as string, log)
  } catch (err) {
    log.error('provision.binding_failed', err)
  }
  return phoneRecord
}
