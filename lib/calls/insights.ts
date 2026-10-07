import 'server-only'
// Dashboard insights from ElevenLabs for ONE organization's own agent:
//   • "What callers ask about": GET /v1/convai/agents/{agent_id}/topics
//     (daily topic-discovery runs, last 30 days), cached 6 h per org;
//   • "Calls in progress": GET /v1/convai/analytics/live-count?agent_id=,
//     cached 15 s per org.
// The agent id is resolved server-side from the org; workspace-wide numbers
// are never computed or returned here. Provider failures degrade to
// "unavailable" (the card hides), never to an error page.

import type { Logger } from '@/lib/observability/logger'
import { agentTopics, liveCount } from '@/lib/elevenlabs/api/conversations'
import { isConfigured } from '@/lib/elevenlabs/client'
import { isProviderError } from '@/lib/voice-providers/errors'
import { rateLimit } from '@/lib/security/rate-limit'
import { INSIGHTS_TOPICS_LIMIT, LIVE_COUNT_LIMIT } from './limits'
import { orgPrimaryElevenLabsAgentId } from './provider-conversation'

const TOPICS_TTL_MS = 6 * 3_600_000
const LIVE_TTL_MS = 15_000
const MAX_CACHE = 2_000
const TOPICS_SHOWN = 8

export interface TopicInsight {
  label: string
  description: string
  conversations: number
  /** 0–100, null when the provider has no score. */
  success_rate: number | null
}

export interface TopicsResponse {
  available: boolean
  topics: TopicInsight[]
  window: { from: string; to: string } | null
}

export interface LiveResponse {
  available: boolean
  count: number | null
}

const topicsCache = new Map<string, { at: number; value: TopicsResponse }>()
const liveCache = new Map<string, { at: number; value: LiveResponse }>()

function remember<T>(cache: Map<string, { at: number; value: T }>, key: string, value: T, now: number): T {
  if (cache.size >= MAX_CACHE) cache.clear()
  cache.set(key, { at: now, value })
  return value
}

/** Test hook. */
export function clearInsightCaches() {
  topicsCache.clear()
  liveCache.clear()
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export async function orgTopics(orgId: string, log: Logger, now = Date.now()): Promise<TopicsResponse> {
  const cached = topicsCache.get(orgId)
  if (cached && now - cached.at < TOPICS_TTL_MS) return cached.value
  const none: TopicsResponse = { available: false, topics: [], window: null }
  if (!isConfigured()) return none
  const agentId = await orgPrimaryElevenLabsAgentId(orgId)
  if (!agentId) return remember(topicsCache, orgId, none, now)
  const limit = await rateLimit(INSIGHTS_TOPICS_LIMIT, orgId, now)
  if (!limit.allowed) return cached?.value ?? none
  try {
    const page = await agentTopics(agentId, { pageSize: 25, fromUnixSecs: Math.floor((now - 30 * 86_400_000) / 1000), toUnixSecs: Math.floor(now / 1000) }, { orgId })
    const topics = (page.topics ?? [])
      .filter((t) => !t.parent_topic_id && typeof t.label === 'string' && t.label.trim())
      .sort((a, b) => (b.conversation_count ?? 0) - (a.conversation_count ?? 0))
      .slice(0, TOPICS_SHOWN)
      .map((t) => ({
        label: clean(t.label, 80),
        description: clean(t.description, 240),
        conversations: Math.max(0, Math.round(t.conversation_count ?? 0)),
        success_rate: typeof t.success_rate === 'number' && Number.isFinite(t.success_rate)
          ? Math.round((t.success_rate <= 1 ? t.success_rate * 100 : t.success_rate))
          : null,
      }))
    const value: TopicsResponse = {
      available: topics.length > 0,
      topics,
      window: typeof page.window_start_unix_secs === 'number' && typeof page.window_end_unix_secs === 'number'
        ? { from: new Date(page.window_start_unix_secs * 1000).toISOString(), to: new Date(page.window_end_unix_secs * 1000).toISOString() }
        : null,
    }
    return remember(topicsCache, orgId, value, now)
  } catch (err) {
    // Topic discovery not enabled for the agent, no run yet, plan without it…
    log.info('insights.topics_unavailable', { code: isProviderError(err) ? err.code : 'unknown' })
    if (!isProviderError(err)) throw err
    return remember(topicsCache, orgId, none, now)
  }
}

export async function orgLiveCount(orgId: string, log: Logger, now = Date.now()): Promise<LiveResponse> {
  const cached = liveCache.get(orgId)
  if (cached && now - cached.at < LIVE_TTL_MS) return cached.value
  const none: LiveResponse = { available: false, count: null }
  if (!isConfigured()) return none
  const agentId = await orgPrimaryElevenLabsAgentId(orgId)
  if (!agentId) return remember(liveCache, orgId, none, now)
  const limit = await rateLimit(LIVE_COUNT_LIMIT, orgId, now)
  if (!limit.allowed) return cached?.value ?? none
  try {
    // agent_id is always set: without it the count would be workspace-wide.
    const { count } = await liveCount({ agentId }, { orgId })
    return remember(liveCache, orgId, { available: true, count: Math.max(0, Math.round(Number(count) || 0)) }, now)
  } catch (err) {
    log.info('insights.live_count_unavailable', { code: isProviderError(err) ? err.code : 'unknown' })
    if (!isProviderError(err)) throw err
    return remember(liveCache, orgId, none, now)
  }
}
