import 'server-only'
// Fixed-window rate limiting for expensive or sensitive endpoints (TTS preview,
// voice import/clone, test/outbound calls, document upload).
//
// State lives in Postgres (`rate_limit_hit` RPC, atomic upsert) so the limit
// holds across serverless instances. If the RPC is unavailable we fall back to
// a per-instance memory window and log it: degraded, never wide open.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/observability/logger'
import { rateLimitedError } from '@/lib/api/http'

const log = createLogger({ component: 'rate_limit' })

export interface RateLimitRule {
  /** Logical bucket name, e.g. "tts_preview". */
  name: string
  limit: number
  windowSeconds: number
}

export const RATE_LIMITS = {
  ttsPreview: { name: 'tts_preview', limit: 20, windowSeconds: 60 },
  ttsPreviewDaily: { name: 'tts_preview_day', limit: 300, windowSeconds: 86_400 },
  voiceProvision: { name: 'voice_provision', limit: 10, windowSeconds: 3_600 },
  voiceClone: { name: 'voice_clone', limit: 3, windowSeconds: 86_400 },
  testCall: { name: 'test_call', limit: 5, windowSeconds: 600 },
  outboundCall: { name: 'outbound_call', limit: 30, windowSeconds: 3_600 },
  knowledgeUpload: { name: 'knowledge_upload', limit: 30, windowSeconds: 3_600 },
  knowledgeProcess: { name: 'knowledge_process', limit: 60, windowSeconds: 3_600 },
  agentSync: { name: 'agent_sync', limit: 30, windowSeconds: 600 },
  voiceCatalog: { name: 'voice_catalog', limit: 120, windowSeconds: 60 },
  callDelete: { name: 'call_delete', limit: 60, windowSeconds: 600 },
  callAudio: { name: 'call_audio', limit: 120, windowSeconds: 600 },
  callIntegration: { name: 'call_integration', limit: 20, windowSeconds: 600 },
  callsExport: { name: 'calls_export', limit: 20, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitRule>

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

const memory = new Map<string, { windowStart: number; count: number }>()

function memoryHit(key: string, rule: RateLimitRule, now: number): RateLimitResult {
  const windowStart = Math.floor(now / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000
  const cur = memory.get(key)
  const count = cur && cur.windowStart === windowStart ? cur.count + 1 : 1
  memory.set(key, { windowStart, count })
  if (memory.size > 10_000) memory.clear()
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), resetAt: windowStart + rule.windowSeconds * 1000 }
}

/** Counts one hit for `subject` (org or user id) against `rule`. */
export async function rateLimit(rule: RateLimitRule, subject: string, now = Date.now()): Promise<RateLimitResult> {
  const key = `${rule.name}:${subject}`
  if (process.env.NODE_ENV === 'test' || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return memoryHit(key, rule, now)
  }
  try {
    const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    if (error) throw new Error(error.message)
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; remaining: number; reset_at: string } | null
    if (!row) throw new Error('rate_limit_hit returned no row')
    return { allowed: row.allowed, remaining: row.remaining, resetAt: Date.parse(row.reset_at) }
  } catch (err) {
    log.warn('rate_limit.db_unavailable', { rule: rule.name, error: String((err as Error)?.message ?? err) })
    return memoryHit(key, rule, now)
  }
}

/** Checks several rules; the first one that denies wins. */
export async function rateLimitAll(rules: RateLimitRule[], subject: string): Promise<RateLimitResult & { rule?: string }> {
  let last: RateLimitResult = { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: Date.now() }
  for (const rule of rules) {
    const r = await rateLimit(rule, subject)
    if (!r.allowed) return { ...r, rule: rule.name }
    last = r
  }
  return last
}

/** Throws a 429 RequestError (with Retry-After) when any rule denies. */
export async function enforceRateLimit(rules: RateLimitRule | RateLimitRule[], subject: string, message?: string): Promise<void> {
  const res = Array.isArray(rules) ? await rateLimitAll(rules, subject) : await rateLimit(rules, subject)
  if (!res.allowed) throw rateLimitedError(res.resetAt, message)
}
