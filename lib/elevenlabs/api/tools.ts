import 'server-only'
// ElevenLabs workspace tools (the reusable tools agents reference through
// conversation_config.agent.prompt.tool_ids). Verified against the official
// OpenAPI spec (2026-10):
//
//   POST   /v1/convai/tools                          ToolRequestModel → ToolResponseModel
//   GET    /v1/convai/tools                          search (name prefix), types, page_size ≤ 100, cursor
//   GET    /v1/convai/tools/{tool_id}                ToolResponseModel (tool_config, usage_stats)
//   PATCH  /v1/convai/tools/{tool_id}                full ToolRequestModel (tool_config is replaced)
//   DELETE /v1/convai/tools/{tool_id}?force=
//   GET    /v1/convai/tools/{tool_id}/dependent-agents   cursor, page_size ≤ 100
//   GET    /v1/convai/tools/{tool_id}/executions         cursor, page_size ≤ 100, is_error, start_time, end_time (unix)
//
// Tools live in the SHARED workspace: only the platform's own webhook tools
// are created here, and no listing is ever proxied to a tenant. Execution
// records carry request/response payloads and webhook headers/body
// (tool_call_details): callers keep counts and timestamps only.

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, type Ctx } from '../client'

const BASE = '/v1/convai/tools'
const enc = encodeURIComponent

/** ToolUsageStatsResponseModel. */
export interface ToolUsageStats {
  total_calls?: number
  avg_latency_secs?: number
}

/** ToolResponseModel (subset). tool_config is the provider's view of the config (with defaults). */
export interface ELTool {
  id: string
  tool_config: Record<string, unknown> & { type?: string; name?: string; api_schema?: { url?: string } }
  usage_stats?: ToolUsageStats
}

/** ToolsResponseModel. */
export interface ELToolsPage {
  tools: ELTool[]
  next_cursor?: string | null
  has_more: boolean
}

/** ToolTypeFilter. */
export type ToolTypeFilter = 'webhook' | 'client' | 'api_integration_webhook'

/** ToolExecutionResponseModel: only the fields the platform reads (never payloads or call details). */
export interface ELToolExecution {
  id: string
  tool_id: string
  agent_id: string
  conversation_id: string
  timestamp: number
  latency_secs: number
  is_error?: boolean
  /** internal, customer_config, customer_auth, external_server, external_client, client_timeout, unknown. */
  error_type?: string | null
}

/** GetToolExecutionsPageResponseModel. */
export interface ELToolExecutionsPage {
  executions: ELToolExecution[]
  next_cursor?: string | null
  has_more: boolean
}

/** DependentAvailableAgentIdentifier | DependentUnknownAgentIdentifier (subset). */
export interface ELDependentAgent {
  id: string
  type?: 'available' | 'unknown'
}

/** GetToolDependentAgentsResponseModel. */
export interface ELToolDependentsPage {
  agents: ELDependentAgent[]
  next_cursor?: string | null
  has_more: boolean
}

const pageSize = (n: number | undefined, fallback: number) => Math.max(1, Math.min(100, Math.floor(n ?? fallback)))

/** Creates a workspace tool. Never retried: a retry after a late upstream success would create a duplicate. */
export function createTool(toolConfig: Record<string, unknown>, ctx?: Ctx) {
  return req<ELTool>('tools.create', BASE, { method: 'POST', body: { tool_config: toolConfig }, retry: NO_RETRY, ctx })
}

export function getTool(toolId: string, ctx?: Ctx) {
  return req<ELTool>('tools.get', `${BASE}/${enc(toolId)}`, { ctx })
}

/** Replaces the tool config (PATCH sends the full ToolRequestModel). Same body twice = same result, so it may be retried. */
export function updateTool(toolId: string, toolConfig: Record<string, unknown>, ctx?: Ctx) {
  return req<ELTool>('tools.update', `${BASE}/${enc(toolId)}`, { method: 'PATCH', body: { tool_config: toolConfig }, idempotent: true, ctx })
}

/** force=false (default) refuses to delete a tool still referenced by agents. */
export function deleteTool(toolId: string, opts: { force?: boolean } = {}, ctx?: Ctx) {
  return req<void>('tools.delete', `${BASE}/${enc(toolId)}`, { method: 'DELETE', query: { force: opts.force === true }, responseKind: 'none', ctx })
}

export function listTools(params: { search?: string; types?: ToolTypeFilter[]; cursor?: string | null; page_size?: number } = {}, ctx?: Ctx) {
  return req<ELToolsPage>('tools.list', BASE, {
    query: { search: params.search, types: params.types, cursor: params.cursor ?? undefined, page_size: pageSize(params.page_size, 100) },
    ctx,
  })
}

export function toolExecutions(
  toolId: string,
  params: { is_error?: boolean; start_time?: number; end_time?: number; agent_id?: string; cursor?: string | null; page_size?: number } = {},
  ctx?: Ctx,
) {
  return req<ELToolExecutionsPage>('tools.executions', `${BASE}/${enc(toolId)}/executions`, {
    query: {
      is_error: params.is_error,
      start_time: params.start_time,
      end_time: params.end_time,
      agent_id: params.agent_id,
      cursor: params.cursor ?? undefined,
      page_size: pageSize(params.page_size, 100),
    },
    ctx,
  })
}

export function toolDependentAgents(toolId: string, params: { cursor?: string | null; page_size?: number } = {}, ctx?: Ctx) {
  return req<ELToolDependentsPage>('tools.dependent_agents', `${BASE}/${enc(toolId)}/dependent-agents`, {
    query: { cursor: params.cursor ?? undefined, page_size: pageSize(params.page_size, 100) },
    ctx,
  })
}

/** Result of a bounded walk through a cursor-paginated listing. */
export interface Paged<T> {
  items: T[]
  /** The page cap was reached while the provider still had more. */
  truncated: boolean
}

/** Follows next_cursor up to maxPages pages; a repeated or missing cursor ends the walk. */
export async function collectPages<T>(
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; next_cursor?: string | null; has_more: boolean }>,
  maxPages: number,
): Promise<Paged<T>> {
  const items: T[] = []
  let cursor: string | null = null
  const seen = new Set<string>()
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(cursor)
    items.push(...res.items)
    const next = res.next_cursor ?? null
    if (!res.has_more || !next || seen.has(next)) return { items, truncated: false }
    seen.add(next)
    cursor = next
  }
  return { items, truncated: true }
}
