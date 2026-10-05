// PATCH  /api/phone/[id] { is_active?, routing_mode? } → number (+ binding result)
//        The binding runs when the mode changes, and also when the same mode is
//        sent again while the number is not 'ready' (a retry after a failed
//        attempt re-applies it instead of reporting success without a binding).
// DELETE /api/phone/[id] → releases the number everywhere (provider imports,
//        Twilio, Stripe) before dropping the row.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { isProviderError } from '@/lib/voice-providers/errors'
import { applyNumberRouting } from '@/lib/telephony/binding'
import { bumpRevision, syncAgent } from '@/lib/voice-providers/agent-sync'
import { maskPhone } from '@/lib/phone/e164'

// Agent re-sync + number binding (provider round-trips) on a routing change.
export const maxDuration = 60

const IdParam = z.uuid()
const PatchBody = z
  .object({
    is_active: z.boolean().optional(),
    routing_mode: z.enum(['app_routed', 'native_elevenlabs']).optional(),
  })
  .refine((b) => b.is_active !== undefined || b.routing_mode !== undefined, 'Nothing to update')

type Params = { params: Promise<{ id: string }> }

async function parseId(params: Params['params']): Promise<string> {
  const { id } = await params
  const parsed = IdParam.safeParse(id)
  if (!parsed.success) throw new RequestError('not_found', 'Number not found.', 404)
  return parsed.data
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.patch' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    const id = await parseId(params)
    log = log.child({ orgId: org.id, phoneNumberId: id })
    const body = await parseJsonBody(request, PatchBody, 4 * 1024)

    const { data: current, error: readErr } = await supabase
      .from('phone_numbers')
      .select('id, agent_id, routing_mode, routing_status')
      .eq('id', id)
      .eq('org_id', org.id)
      .maybeSingle()
    if (readErr) throw new Error(`phone_numbers read failed: ${readErr.message}`)
    if (!current) throw new RequestError('not_found', 'Number not found.', 404)

    if (body.is_active !== undefined) {
      const { error } = await supabase.from('phone_numbers').update({ is_active: body.is_active }).eq('id', id).eq('org_id', org.id)
      if (error) throw new Error(`phone_numbers update failed: ${error.message}`)
    }

    let binding: Awaited<ReturnType<typeof applyNumberRouting>> | null = null
    // Same mode re-sent while not 'ready' (e.g. after a failed attempt): re-apply.
    if (body.routing_mode && (body.routing_mode !== current.routing_mode || current.routing_status !== 'ready')) {
      await enforceRateLimit(RATE_LIMITS.agentSync, org.id)
      if (body.routing_mode === 'native_elevenlabs' && !el.isConfigured()) {
        throw new RequestError('not_configured', 'Direct ElevenLabs routing is not available on this platform.', 503)
      }
      // routing_mode/routing_status are platform-managed columns (guard trigger).
      const admin = createAdminClient()
      const { error } = await admin
        .from('phone_numbers')
        .update({ routing_mode: body.routing_mode, routing_status: 'pending', routing_error: null })
        .eq('id', id)
        .eq('org_id', org.id)
      if (error) throw new Error(`phone_numbers routing update failed: ${error.message}`)
      // The agent's telephony audio format depends on the routing mode
      // (μ-law for app-routed register-call), so re-sync it before binding.
      if (current.agent_id) {
        await bumpRevision(current.agent_id as string)
        const [res] = await syncAgent(current.agent_id as string, { providers: ['elevenlabs'], log })
        if (res && res.status !== 'ready') log.warn('phone.routing_agent_sync_not_ready', { status: res.status })
      }
      binding = await applyNumberRouting(id, log)
      log.info('phone.routing_mode_changed', {
        mode: body.routing_mode,
        previousMode: current.routing_mode,
        previousStatus: current.routing_status,
        status: binding.status,
      })
    }

    const { data, error } = await supabase.from('phone_numbers').select('*, agents(name)').eq('id', id).eq('org_id', org.id).single()
    if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
    return NextResponse.json(binding ? { ...data, binding } : data)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.patch_failed', requestId)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.delete' })
  try {
    assertSameOrigin(request)
    const { supabase, org, user } = await requireOrg()
    const id = await parseId(params)
    log = log.child({ orgId: org.id, phoneNumberId: id })

    const { data: num, error: readErr } = await supabase
      .from('phone_numbers')
      .select('id, number, twilio_sid, elevenlabs_phone_number_id, cartesia_phone_number_id, stripe_subscription_id')
      .eq('id', id)
      .eq('org_id', org.id)
      .maybeSingle()
    if (readErr) throw new Error(`phone_numbers read failed: ${readErr.message}`)
    if (!num) throw new RequestError('not_found', 'Number not found.', 404)
    log = log.child({ number: maskPhone(num.number as string) })
    const warnings: string[] = []

    // 1. Provider imports (dangling imports are harmless but clutter the
    //    workspaces): failures are logged and reported, not fatal.
    if (el.isConfigured() && num.elevenlabs_phone_number_id) {
      try {
        await el.phoneNumbers.delete(num.elevenlabs_phone_number_id as string)
      } catch (err) {
        if (!(isProviderError(err) && err.code === 'not_found')) {
          log.error('phone.release_elevenlabs_failed', err)
          warnings.push('elevenlabs_import_not_removed')
        }
      }
    }
    if (ct.isConfigured() && num.cartesia_phone_number_id) {
      try {
        await ct.telephony.deleteNumber(num.cartesia_phone_number_id as string)
      } catch (err) {
        if (!(isProviderError(err) && err.code === 'not_found')) {
          log.error('phone.release_cartesia_failed', err)
          warnings.push('cartesia_import_not_removed')
        }
      }
    }

    // 2. Twilio release is what stops the per-number cost: if it fails the
    //    row is kept so the owner can retry (no orphaned paid numbers).
    const twilioSid = num.twilio_sid && !String(num.twilio_sid).startsWith('mock') ? (num.twilio_sid as string) : null
    if (twilioSid) {
      if (!isTwilioConfigured()) throw new RequestError('not_configured', 'Telephony is not configured on the platform.', 503)
      try {
        await getTwilioClient().incomingPhoneNumbers(twilioSid).remove()
      } catch (err) {
        const status = (err as { status?: number }).status
        if (status !== 404) {
          log.error('phone.release_twilio_failed', err)
          throw new RequestError('provider_error', 'The number could not be released right now. Please try again.', 502)
        }
      }
    }

    // 3. Billing. A failure here must not be silent: logged as an error and
    //    recorded in the audit log with the subscription for follow-up.
    const admin = createAdminClient()
    if (isStripeConfigured() && num.stripe_subscription_id) {
      try {
        await getStripeClient().subscriptions.cancel(num.stripe_subscription_id as string)
      } catch (err) {
        log.error('phone.release_stripe_cancel_failed', err)
        warnings.push('billing_not_cancelled')
        const { error: auditErr } = await admin.from('audit_log').insert({
          org_id: org.id,
          actor_user_id: user.id,
          action: 'phone.release.billing_cancel_failed',
          target_type: 'phone_number',
          target_id: id,
          details: { stripe_subscription_id: num.stripe_subscription_id },
        })
        if (auditErr) log.error('phone.audit_write_failed', auditErr)
      }
    }

    const { error } = await supabase.from('phone_numbers').delete().eq('id', id).eq('org_id', org.id)
    if (error) throw new Error(`phone_numbers delete failed: ${error.message}`)
    const { error: auditErr } = await admin.from('audit_log').insert({
      org_id: org.id,
      actor_user_id: user.id,
      action: 'phone.released',
      target_type: 'phone_number',
      target_id: id,
      details: { warnings },
    })
    if (auditErr) log.error('phone.audit_write_failed', auditErr)
    log.info('phone.released', { warnings })
    return NextResponse.json({
      success: true,
      ...(warnings.includes('billing_not_cancelled')
        ? { warning: 'The number was released, but its billing could not be cancelled automatically. Please contact support.' }
        : {}),
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.delete_failed', requestId)
  }
}
