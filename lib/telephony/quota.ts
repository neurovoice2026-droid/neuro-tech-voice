// Plan minutes at call start: a hard cap on every plan. Capacity = the
// period's included minutes left (organizations.minutes_limit - minutes_used,
// never below 0) + the purchased extra minutes (extra_minutes_balance,
// prepaid packs of lib/billing/minute-packs.ts; nothing is billed after the
// fact):
//   • no capacity → no call is placed (dashboard, campaign and store
//                   automation calls), a native inbound call hears the
//                   "unavailable" line (initiation webhook) and an app-routed
//                   one is refused by the router like a paused agent;
//   • otherwise   → the call may last at most the capacity left (sent as the
//                   conversation.max_duration_seconds override where the agent
//                   allows it, and as the Twilio time limit), never less than
//                   MIN_CAPPED_CALL_SECONDS.
// An unknown plan value, or a missing minutes_limit, is never enforced (fail
// open: billing data drift must not take a customer's phone line down).
// VOICE_TRIAL_MINUTES_ENFORCED=false is the global minute-cap switch: it turns
// the whole check off for every plan (the name predates the paid-plan cap).
// Pure.

import { minutesCapacity } from '@/lib/billing/minute-packs'
import { PLANS } from '@/types'

export interface OrgUsage {
  plan: string | null
  minutes_used: number | null
  minutes_limit: number | null
  /** Purchased minutes left (migration 027); missing = none. */
  extra_minutes_balance?: number | null
}

export interface CallAllowance {
  /** False: the included minutes and the purchased ones are used up. */
  allowed: boolean
  /** Seconds the call may last (null = no cap: unknown plan, missing limit, or the cap is off). */
  capSeconds: number | null
}

/** A capped call still lasts at least this long (a shorter cap would cut the greeting). */
export const MIN_CAPPED_CALL_SECONDS = 60

/** The global minute-cap switch: VOICE_TRIAL_MINUTES_ENFORCED=false turns the cap off on every plan. */
export function minuteCapEnforced(): boolean {
  return (process.env.VOICE_TRIAL_MINUTES_ENFORCED ?? '').trim().toLowerCase() !== 'false'
}

export function callAllowance(usage: OrgUsage | null | undefined): CallAllowance {
  const open: CallAllowance = { allowed: true, capSeconds: null }
  if (!usage || !minuteCapEnforced()) return open
  if (!usage.plan || !Object.hasOwn(PLANS, usage.plan)) return open
  const limit = Number(usage.minutes_limit)
  if (usage.minutes_limit === null || usage.minutes_limit === undefined || !Number.isFinite(limit) || limit <= 0) return open
  const { total } = minutesCapacity(usage)
  if (total <= 0) return { allowed: false, capSeconds: 0 }
  return { allowed: true, capSeconds: Math.max(MIN_CAPPED_CALL_SECONDS, Math.floor(total * 60)) }
}

/**
 * The cap for a call that is already connected (an answered outbound call,
 * a fallback leg): the capacity left, and MIN_CAPPED_CALL_SECONDS when none
 * is left (the call is not dropped mid-greeting). null = no cap.
 */
export function connectedCallCapSeconds(usage: OrgUsage | null | undefined): number | null {
  const allowance = callAllowance(usage)
  return allowance.allowed ? allowance.capSeconds : MIN_CAPPED_CALL_SECONDS
}
