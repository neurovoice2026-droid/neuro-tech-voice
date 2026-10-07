// Plan minutes at call start. Paid plans bill overage (PLANS[plan].overage_per_min
// > 0), so their calls are never refused or capped here. A plan without
// overage (the trial) stops at organizations.minutes_limit:
//   • exhausted  → no call is placed, a native inbound call hears the
//                  "unavailable" line (initiation webhook) and an app-routed
//                  one is refused by the router like a paused agent;
//   • otherwise  → the call may last at most the minutes left (sent as the
//                  conversation.max_duration_seconds override where the agent
//                  allows it).
// An unknown plan value is never enforced (fail open: billing data drift must
// not take a customer's phone line down). VOICE_TRIAL_MINUTES_ENFORCED=false
// turns the whole check off. Pure.

import { PLANS, type Plan } from '@/types'

export interface OrgUsage {
  plan: string | null
  minutes_used: number | null
  minutes_limit: number | null
}

export interface CallAllowance {
  /** False: the plan's included minutes are used up and it has no overage. */
  allowed: boolean
  /** Seconds left on a plan without overage (null = no plan cap). */
  capSeconds: number | null
}

/** A capped call still lasts at least this long (a shorter cap would cut the greeting). */
export const MIN_CAPPED_CALL_SECONDS = 60

export function trialMinutesEnforced(): boolean {
  return (process.env.VOICE_TRIAL_MINUTES_ENFORCED ?? '').trim().toLowerCase() !== 'false'
}

export function callAllowance(usage: OrgUsage | null | undefined): CallAllowance {
  const open: CallAllowance = { allowed: true, capSeconds: null }
  if (!usage || !trialMinutesEnforced()) return open
  const plan = usage.plan && Object.hasOwn(PLANS, usage.plan) ? PLANS[usage.plan as Plan] : null
  if (!plan || plan.overage_per_min > 0) return open
  const limit = Number(usage.minutes_limit)
  if (!Number.isFinite(limit) || limit <= 0) return open
  const used = Math.max(0, Number(usage.minutes_used) || 0)
  const left = limit - used
  if (left <= 0) return { allowed: false, capSeconds: 0 }
  return { allowed: true, capSeconds: Math.max(MIN_CAPPED_CALL_SECONDS, Math.floor(left * 60)) }
}
