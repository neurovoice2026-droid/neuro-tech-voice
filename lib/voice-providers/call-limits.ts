// Per-agent call limits derived from the organization's plan. Every tenant
// shares ONE ElevenLabs workspace (and its concurrency), so each agent gets a
// cap: one tenant's spike or a robocall flood cannot starve the others. Never
// tenant-editable: values come from the plan and platform env only.
// Pure (env in, numbers out), client-safe.

import type { Plan } from '@/types'

type Env = Record<string, string | undefined>

/** Simultaneous conversations per agent, by plan. */
export const PLAN_CONCURRENCY: Record<Plan, number> = {
  trial: 2,
  starter: 2,
  pro: 4,
  business: 6,
  custom: 10,
}

export const DEFAULT_DAILY_CALL_LIMIT = 500
/** Spec default of daily_limit; also our upper bound for the env override. */
const MAX_DAILY_CALL_LIMIT = 100_000
const MAX_CONCURRENCY = 1_000

export interface CallLimits {
  /** platform_settings.call_limits.agent_concurrency_limit (-1 = no per-agent cap). */
  concurrency: number
  /** Conversations per day (daily_limit). */
  daily: number
  /** Accept calls above the workspace concurrency at double price (bursting_enabled). */
  bursting: boolean
}

function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && Object.hasOwn(PLAN_CONCURRENCY, value)
}

function intIn(raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const v = Number(raw)
  return Number.isInteger(v) && v >= min && v <= max ? v : null
}

/** ELEVENLABS_CONCURRENCY_<PLAN> (1–1000, or -1 for no cap) overrides the plan default. */
export function planConcurrency(plan: unknown, env: Env = process.env): number {
  const p: Plan = isPlan(plan) ? plan : 'trial'
  const raw = env[`ELEVENLABS_CONCURRENCY_${p.toUpperCase()}`]
  if (raw !== undefined && raw.trim() === '-1') return -1
  return intIn(raw, 1, MAX_CONCURRENCY) ?? PLAN_CONCURRENCY[p]
}

/** ELEVENLABS_DAILY_CALL_LIMIT (1–100000), default 500 conversations per agent and day. */
export function dailyCallLimit(env: Env = process.env): number {
  return intIn(env.ELEVENLABS_DAILY_CALL_LIMIT, 1, MAX_DAILY_CALL_LIMIT) ?? DEFAULT_DAILY_CALL_LIMIT
}

/** ELEVENLABS_BURSTING (default true): keep answering above the workspace concurrency, at 2x price. */
export function burstingEnabled(env: Env = process.env): boolean {
  return (env.ELEVENLABS_BURSTING ?? '').trim().toLowerCase() !== 'false'
}

/** Limits for an organization's agent; an unknown or missing plan gets the trial values. */
export function callLimitsFor(plan: unknown, env: Env = process.env): CallLimits {
  return { concurrency: planConcurrency(plan, env), daily: dailyCallLimit(env), bursting: burstingEnabled(env) }
}

/** Env values that are set but invalid (ignored, defaults used): for diagnostics. */
export function invalidCallLimitEnv(env: Env = process.env): string[] {
  const out: string[] = []
  for (const p of Object.keys(PLAN_CONCURRENCY)) {
    const key = `ELEVENLABS_CONCURRENCY_${p.toUpperCase()}`
    const raw = env[key]
    if (raw !== undefined && raw.trim() !== '' && raw.trim() !== '-1' && intIn(raw, 1, MAX_CONCURRENCY) === null) out.push(key)
  }
  const daily = env.ELEVENLABS_DAILY_CALL_LIMIT
  if (daily !== undefined && daily.trim() !== '' && intIn(daily, 1, MAX_DAILY_CALL_LIMIT) === null) out.push('ELEVENLABS_DAILY_CALL_LIMIT')
  const burst = (env.ELEVENLABS_BURSTING ?? '').trim().toLowerCase()
  if (burst && burst !== 'true' && burst !== 'false') out.push('ELEVENLABS_BURSTING')
  return out
}
