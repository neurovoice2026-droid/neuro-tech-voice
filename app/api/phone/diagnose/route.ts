// Phone routing diagnostics for the signed-in organization.
//   GET  — read-only: what the DB, Twilio and the providers say about each
//          number and the agent (no side effects, safe to open any time);
//   POST — repair: re-sync the agent on every provider, then re-apply each
//          number's routing binding. Same-origin + rate limited.
// Responses never include provider secrets or upstream error bodies.
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { toProviderError } from '@/lib/voice-providers/errors'
import { publicBaseUrl } from '@/lib/voice-providers/config'
import { ingressUrls, applyNumberRouting } from '@/lib/telephony/binding'
import { syncAgent } from '@/lib/voice-providers/agent-sync'
import { peek } from '@/lib/voice-providers/circuit-registry'
import { maskPhone } from '@/lib/phone/e164'

interface NumberRow {
  id: string
  number: string
  twilio_sid: string | null
  is_active: boolean
  routing_mode: string
  routing_status: string | null
  routing_error: string | null
  routing_synced_at: string | null
  elevenlabs_phone_number_id: string | null
  cartesia_phone_number_id: string | null
}

function safe(err: unknown, system: 'twilio' | 'elevenlabs' | 'cartesia', op: string): string {
  const pe = toProviderError(err, system, op)
  return pe.code === 'unknown' ? 'check failed' : pe.safeMessage
}

async function loadState(supabase: Awaited<ReturnType<typeof requireOrg>>['supabase'], orgId: string) {
  const [{ data: agent, error: agentErr }, { data: numbers, error: numErr }] = await Promise.all([
    supabase.from('agents').select('id, name, is_active, voice_sync_status, voice_sync_error').eq('org_id', orgId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabase
      .from('phone_numbers')
      .select('id, number, twilio_sid, is_active, routing_mode, routing_status, routing_error, routing_synced_at, elevenlabs_phone_number_id, cartesia_phone_number_id')
      .eq('org_id', orgId),
  ])
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
  if (numErr) throw new Error(`phone_numbers read failed: ${numErr.message}`)
  const { data: resources, error: resErr } = agent
    ? await supabase.from('agent_provider_resources').select('provider, external_id, status, last_error, last_synced_at').eq('agent_id', agent.id)
    : { data: [], error: null }
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  return { agent, numbers: (numbers ?? []) as NumberRow[], resources: resources ?? [] }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.diagnose' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.agentSync, org.id)
    const { agent, numbers, resources } = await loadState(supabase, org.id)
    const elAgentId = resources.find((r) => r.provider === 'elevenlabs')?.external_id as string | undefined
    const base = publicBaseUrl()
    const expected = base ? ingressUrls(base) : null

    const report = await Promise.all(
      numbers.map(async (n) => {
        const out: Record<string, unknown> = {
          id: n.id,
          number: maskPhone(n.number),
          is_active: n.is_active,
          routing_mode: n.routing_mode,
          routing_status: n.routing_status,
          routing_error: n.routing_error,
          routing_synced_at: n.routing_synced_at,
        }
        const twilioSid = n.twilio_sid && !n.twilio_sid.startsWith('mock') ? n.twilio_sid : null
        if (twilioSid && isTwilioConfigured()) {
          try {
            const tw = await getTwilioClient().incomingPhoneNumbers(twilioSid).fetch()
            const voiceUrl = tw.voiceUrl || ''
            out.twilio = {
              voice_webhook:
                !voiceUrl ? 'none'
                : expected && voiceUrl === expected.voiceUrl ? 'platform'
                : /elevenlabs\.io/i.test(voiceUrl) ? 'elevenlabs'
                : 'other',
              fallback_webhook_set: expected ? tw.voiceFallbackUrl === expected.voiceFallbackUrl : false,
              status_callback_set: expected ? tw.statusCallback === expected.statusCallback : false,
              voice_capable: tw.capabilities?.voice !== false,
            }
          } catch (err) {
            log.warn('diagnose.twilio_failed', { phoneNumberId: n.id, error: safe(err, 'twilio', 'diagnose') })
            out.twilio = { error: safe(err, 'twilio', 'diagnose') }
          }
        }
        if (n.elevenlabs_phone_number_id && el.isConfigured()) {
          try {
            const p = await el.phoneNumbers.get(n.elevenlabs_phone_number_id)
            out.elevenlabs_import = { present: true, assigned_to_agent: !!elAgentId && p.assigned_agent?.agent_id === elAgentId }
          } catch (err) {
            out.elevenlabs_import = { present: false, error: safe(err, 'elevenlabs', 'diagnose') }
          }
        }
        if (n.cartesia_phone_number_id && ct.isConfigured()) {
          try {
            await ct.telephony.getNumber(n.cartesia_phone_number_id)
            out.cartesia_import = { present: true }
          } catch (err) {
            out.cartesia_import = { present: false, error: safe(err, 'cartesia', 'diagnose') }
          }
        }
        return out
      }),
    )

    const [elCircuit, ctCircuit] = await Promise.all([peek('elevenlabs'), peek('cartesia')])
    return NextResponse.json(
      {
        agent: agent
          ? { name: agent.name, is_active: agent.is_active, voice_sync_status: agent.voice_sync_status, voice_sync_error: agent.voice_sync_error }
          : null,
        providers: resources.map((r) => ({ provider: r.provider, status: r.status, has_external_agent: !!r.external_id, last_error: r.last_error, last_synced_at: r.last_synced_at })),
        provider_health: { elevenlabs: elCircuit.state, cartesia: ctCircuit.state },
        numbers: report,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.diagnose_failed', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.diagnose.repair' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.agentSync, org.id)
    const { agent, numbers } = await loadState(supabase, org.id)
    const sync = agent ? await syncAgent(agent.id as string, { force: true, log }) : []
    const bindings = []
    for (const n of numbers) {
      const result = await applyNumberRouting(n.id, log)
      bindings.push({ id: n.id, number: maskPhone(n.number), ...result })
    }
    log.info('diagnose.repair', { numbers: bindings.length })
    return NextResponse.json(
      { sync: sync.map((s) => ({ provider: s.provider, status: s.status, error: s.error ?? null })), numbers: bindings },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.diagnose_repair_failed', requestId)
  }
}
