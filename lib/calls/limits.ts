// Per-organization rate limits of the call and insight endpoints that reach
// the voice provider (lib/security/rate-limit.ts enforces them).

import type { RateLimitRule } from '@/lib/security/rate-limit'

/** Thumbs up/down: local write + one provider POST. */
export const CALL_FEEDBACK_LIMIT: RateLimitRule = { name: 'call_feedback', limit: 60, windowSeconds: 3_600 }

/** Re-running the analysis is billed to the platform (analysis LLM). */
export const CALL_REANALYZE_LIMITS: RateLimitRule[] = [
  { name: 'call_reanalyze', limit: 5, windowSeconds: 600 },
  { name: 'call_reanalyze_day', limit: 20, windowSeconds: 86_400 },
]

/** Topic discovery results (counted only on a cache miss). */
export const INSIGHTS_TOPICS_LIMIT: RateLimitRule = { name: 'insights_topics', limit: 30, windowSeconds: 3_600 }

/** "Calls in progress" (counted only on a cache miss). */
export const LIVE_COUNT_LIMIT: RateLimitRule = { name: 'live_count', limit: 240, windowSeconds: 3_600 }
