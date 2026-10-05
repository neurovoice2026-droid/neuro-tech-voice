import 'server-only'
// Binds a Twilio number to the routing mode the owner chose:
//
//   app_routed (default for new numbers, required for failover/after-hours):
//     • the Twilio number's voice URL, fallback URL and status callback point
//       at our ingress;
//     • if it was natively imported into ElevenLabs, that import is removed
//       (otherwise ElevenLabs would keep owning the webhook);
//     • the number is imported into Cartesia under the platform SIP trunk
//       provider and assigned to the org's fallback agent (Cartesia routes
//       SIP calls by dialed number; this does NOT touch the Twilio webhook).
//
//   native_elevenlabs (explicit opt-in): the number is imported into
//     ElevenLabs, which rewrites the Twilio voice webhook to its own endpoint.
//     Native transfers work; failover, after-hours gate and our call routing
//     do not (documented trade-off).

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { publicBaseUrl } from '@/lib/voice-providers/config'
import { tryPlatformResource } from '@/lib/voice-providers/platform-resources'
import { isProviderError, toProviderError } from '@/lib/voice-providers/errors'
import type { RoutingMode } from '@/lib/voice-providers/types'
import { maskPhone } from '@/lib/phone/e164'

export interface BindingResult {
  status: 'ready' | 'degraded' | 'failed'
  steps: Array<{ step: string; ok: boolean; error?: string }>
}

export function ingressUrls(base: string) {
  return {
    voiceUrl: `${base}/api/telephony/twilio/inbound`,
    voiceFallbackUrl: `${base}/api/telephony/twilio/fallback`,
    statusCallback: `${base}/api/telephony/twilio/status`,
  }
}

export async function applyNumberRouting(phoneNumberId: string, log: Logger = createLogger()): Promise<BindingResult> {
  const db = createAdminClient()
  const { data: n, error } = await db
    .from('phone_numbers')
    .select('id, org_id, agent_id, number, twilio_sid, routing_mode, elevenlabs_phone_number_id, cartesia_phone_number_id')
    .eq('id', phoneNumberId)
    .single()
  if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
  const l = log.child({ orgId: n.org_id, phoneNumberId, number: maskPhone(n.number as string) })
  const steps: BindingResult['steps'] = []
  const twilioSid = n.twilio_sid && !String(n.twilio_sid).startsWith('mock') ? (n.twilio_sid as string) : null

  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select('id')
    .eq('org_id', n.org_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
  const { data: resources, error: resErr } = agent
    ? await db.from('agent_provider_resources').select('provider, external_id').eq('agent_id', agent.id)
    : { data: [], error: null }
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  const ext = Object.fromEntries((resources ?? []).filter((r) => r.external_id).map((r) => [r.provider, r.external_id as string])) as Record<string, string>

  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
      steps.push({ step: name, ok: true })
    } catch (err) {
      const pe = toProviderError(err, name.startsWith('cartesia') ? 'cartesia' : name.startsWith('elevenlabs') ? 'elevenlabs' : 'twilio', name)
      l.error('binding.step_failed', err, { step: name })
      steps.push({ step: name, ok: false, error: pe.code === 'unknown' ? 'failed' : pe.safeMessage })
    }
  }

  const mode = n.routing_mode as RoutingMode
  const patch: Record<string, unknown> = {}

  if (mode === 'app_routed') {
    if (n.elevenlabs_phone_number_id) {
      await step('elevenlabs.remove_native_import', async () => {
        try {
          await el.phoneNumbers.delete(n.elevenlabs_phone_number_id as string)
        } catch (err) {
          if (!(isProviderError(err) && err.code === 'not_found')) throw err
        }
        patch.elevenlabs_phone_number_id = null
      })
    }
    // Set our webhooks AFTER removing the native import (which may clear them).
    await step('twilio.configure_webhooks', async () => {
      const base = publicBaseUrl()
      if (!base) throw new Error('VOICE_PUBLIC_BASE_URL not configured')
      if (!twilioSid || !isTwilioConfigured()) throw new Error('number has no Twilio SID / Twilio not configured')
      const urls = ingressUrls(base)
      await getTwilioClient().incomingPhoneNumbers(twilioSid).update({
        voiceUrl: urls.voiceUrl,
        voiceMethod: 'POST',
        voiceFallbackUrl: urls.voiceFallbackUrl,
        voiceFallbackMethod: 'POST',
        statusCallback: urls.statusCallback,
        statusCallbackMethod: 'POST',
      })
    })
    if (ct.isConfigured() && ext.cartesia) {
      await step('cartesia.sip_import', async () => {
        const providerId = await tryPlatformResource('cartesia.sip_provider')
        if (!providerId) throw new Error('Cartesia SIP provider unavailable (check CARTESIA_SIP_USERNAME/PASSWORD)')
        if (n.cartesia_phone_number_id) {
          await ct.telephony.updateNumber(n.cartesia_phone_number_id as string, { agent_id: ext.cartesia })
        } else {
          const imported = await ct.telephony.importNumber({ label: `ntv ${String(n.org_id).slice(0, 8)}`, number: n.number as string, provider: { id: providerId }, agent_id: ext.cartesia })
          patch.cartesia_phone_number_id = imported.id
        }
      })
    }
  } else {
    await step('elevenlabs.native_import', async () => {
      if (!ext.elevenlabs) throw new Error('ElevenLabs agent not created yet')
      if (!twilioSid) throw new Error('number has no Twilio SID')
      if (n.elevenlabs_phone_number_id) {
        await el.phoneNumbers.update(n.elevenlabs_phone_number_id as string, { agent_id: ext.elevenlabs })
      } else {
        const imported = await el.phoneNumbers.importTwilio({
          phone_number: n.number as string,
          label: `ntv ${String(n.org_id).slice(0, 8)}`,
          agent_id: ext.elevenlabs,
          sid: (process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
          token: (process.env.TWILIO_AUTH_TOKEN ?? '').trim(),
        })
        patch.elevenlabs_phone_number_id = imported.phone_number_id
      }
    })
  }

  const critical = steps.filter((s) => s.step === 'twilio.configure_webhooks' || s.step === 'elevenlabs.native_import')
  const status: BindingResult['status'] = critical.some((s) => !s.ok) ? 'failed' : steps.some((s) => !s.ok) ? 'degraded' : 'ready'
  const firstError = steps.find((s) => !s.ok)?.error ?? null
  const { error: updErr } = await db
    .from('phone_numbers')
    .update({ ...patch, routing_status: status, routing_error: firstError, routing_synced_at: new Date().toISOString(), agent_id: agent?.id ?? null })
    .eq('id', phoneNumberId)
  if (updErr) l.error('binding.status_write_failed', updErr)
  l.info('binding.applied', { mode, status })
  return { status, steps }
}
