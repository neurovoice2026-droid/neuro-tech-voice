// "Call a customer" (Calls page): what the owner may do right now, checking
// the number they typed, and plain words for what the API answers. Pure and
// client-safe; POST /api/calls/outbound enforces the same rules again.

import { destinationRefusalMessage, isPremiumRateNumber } from '@/lib/phone/destinations'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import type { Plan } from '@/types'

/** Loaded on the server for the Calls page. */
export interface OutboundCallSetup {
  /** The plan includes outbound calls. */
  entitled: boolean
  /** Cheapest plan that does, for the upgrade notice. */
  requiredPlan: Plan
  /** Twilio is set up on this deployment. */
  configured: boolean
  /** The organisation's active number the call is placed from. */
  phoneNumber: string | null
  /** null when the organisation has no agent yet. */
  agentActive: boolean | null
}

export type OutboundAvailability =
  | { kind: 'ready'; from: string }
  | { kind: 'locked'; requiredPlan: Plan }
  | { kind: 'not_configured' }
  | { kind: 'no_number' }
  | { kind: 'no_agent' }
  | { kind: 'agent_paused' }

/** The first thing standing between the owner and a call, in the order they'd fix it. */
export function outboundAvailability(setup: OutboundCallSetup): OutboundAvailability {
  if (!setup.entitled) return { kind: 'locked', requiredPlan: setup.requiredPlan }
  if (!setup.configured) return { kind: 'not_configured' }
  if (setup.agentActive === null) return { kind: 'no_agent' }
  if (!setup.phoneNumber) return { kind: 'no_number' }
  if (!setup.agentActive) return { kind: 'agent_paused' }
  return { kind: 'ready', from: setup.phoneNumber }
}

export const OUTBOUND_PURPOSE_MAX = 500

export type OutboundInputResult =
  | { ok: true; to: string; purpose: string | null }
  | { ok: false; field: 'to_number' | 'purpose'; message: string }

export function validateOutboundInput(rawNumber: string, rawPurpose: string, fromNumber: string | null): OutboundInputResult {
  const to = normalizeE164(rawNumber)
  if (!to) {
    return { ok: false, field: 'to_number', message: 'Enter the full number with the country code, like +40 712 345 678.' }
  }
  if (fromNumber && to === fromNumber) {
    return { ok: false, field: 'to_number', message: 'That’s your agent’s own number. Enter the customer’s number.' }
  }
  if (isPremiumRateNumber(to)) {
    return { ok: false, field: 'to_number', message: destinationRefusalMessage('premium_rate') }
  }
  const purpose = rawPurpose.trim()
  if (purpose.length > OUTBOUND_PURPOSE_MAX) {
    return { ok: false, field: 'purpose', message: `Keep the reason under ${OUTBOUND_PURPOSE_MAX} characters.` }
  }
  return { ok: true, to, purpose: purpose || null }
}

export interface OutboundApiError {
  status: number
  code: string
  message: string | null
}

/** Where a refused request leaves the dialog: back to the form with a message, or to a blocking state. */
export function outboundErrorOutcome(error: OutboundApiError): { field: 'to_number' | null; message: string; blocking: OutboundAvailability['kind'] | null } {
  switch (error.code) {
    case 'invalid_phone':
    case 'destination_not_allowed':
    case 'uncallable_number':
    case 'opted_out':
      return { field: 'to_number', message: error.message ?? 'We can’t call that number. Please check it and try again.', blocking: null }
    case 'upgrade_required':
      return { field: null, message: error.message ?? 'Calling customers is available on paid plans.', blocking: 'locked' }
    case 'not_configured':
      return { field: null, message: error.message ?? 'Phone calls aren’t available yet.', blocking: 'not_configured' }
    case 'no_phone_number':
      return { field: null, message: error.message ?? 'You need an active phone number to place calls.', blocking: 'no_number' }
    case 'agent_inactive':
      return { field: null, message: error.message ?? 'Your agent is paused. Turn it on before placing calls.', blocking: 'agent_paused' }
  }
  if (error.status === 401) return { field: null, message: 'Your session has expired. Please sign in again.', blocking: null }
  if (error.status === 429) return { field: null, message: error.message ?? 'You’ve placed a lot of calls in a short time. Please try again later.', blocking: null }
  if (error.status >= 500) return { field: null, message: error.message ?? 'The call couldn’t be started. Please try again in a moment.', blocking: null }
  return { field: null, message: error.message ?? 'The call couldn’t be started. Please try again.', blocking: null }
}

/** Confirmation line once Twilio accepted the call. */
export function callingMessage(to: string): string {
  return `Calling ${maskPhone(to)}. The call appears in your list right away and gets its summary when it ends.`
}
