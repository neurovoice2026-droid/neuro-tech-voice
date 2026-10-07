import 'server-only'
// ElevenLabs conversation history, analytics and topics, verified against the
// official OpenAPI spec (2026-10):
//   GET  /v1/convai/conversations                       (list, filters, cursor)
//   GET  /v1/convai/conversations/{id}                  (full conversation)
//   POST /v1/convai/conversations/{id}/feedback         {feedback: like|dislike|null}
//   POST /v1/convai/conversations/{id}/analysis/run     (re-runs evaluation + data collection)
//   GET  /v1/convai/analytics/live-count                (agent_id | agent_ids)
//   GET  /v1/convai/agents/{agent_id}/topics            (daily topic-discovery runs)
//
// TENANT ISOLATION: every tenant shares one workspace. The list endpoint
// without agent_id returns EVERY tenant's conversations, so listConversations
// requires the agent id (always the org's own agent, resolved server-side),
// and callers verify agent_id on every conversation they read before using it.
// Nothing here is ever proxied to a browser unfiltered.

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, type Ctx } from '../client'

/** GetConversationsPageResponseModel page_size cap ("Can not exceed 100"). */
export const CONVERSATIONS_MAX_PAGE_SIZE = 100

/** Conversation status enum (GetConversationResponseModel.status / list exclude_statuses). */
export type ELConversationStatus = 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed'

/** Statuses after which a conversation never changes again (safe to apply and bill). */
export const FINAL_CONVERSATION_STATUSES: ReadonlySet<string> = new Set(['done', 'failed'])

/** ConversationSummaryResponseModel (subset). Has no dynamic variables nor phone_call: GET the details before applying. */
export interface ELConversationListItem {
  agent_id: string
  conversation_id: string
  start_time_unix_secs: number
  call_duration_secs: number
  status: ELConversationStatus
  /** ConversationInitiationSource (twilio, sip_trunk, widget, js_sdk, react_sdk, template_preview, …). */
  conversation_initiation_source?: string | null
  direction?: 'inbound' | 'outbound' | null
}

export interface ELConversationsPage {
  conversations: ELConversationListItem[]
  next_cursor?: string | null
  has_more: boolean
}

/** ConversationHistoryTranscriptResponseModel (subset; tool params/details are never read). */
export interface ELTranscriptTurnDetails {
  role: string
  message?: string | null
  time_in_call_secs: number
  tool_calls?: Array<{ tool_name?: string; request_id?: string; type?: string | null }>
  tool_results?: Array<{
    tool_name?: string
    request_id?: string
    is_error?: boolean
    type?: string | null
    /** Only on system tool results: result.result_type (transfer_to_number_twilio_success, voicemail_detection_success, end_call_success, …). */
    result?: { result_type?: string; status?: string } | null
  }>
}

/** GetConversationResponseModel (subset the platform reads). Same shape as post_call_transcription `data`. */
export interface ELConversationDetails {
  conversation_id: string
  agent_id: string
  status: ELConversationStatus
  user_id?: string | null
  branch_id?: string | null
  version_id?: string | null
  environment?: string
  transcript: ELTranscriptTurnDetails[]
  metadata: {
    start_time_unix_secs: number
    accepted_time_unix_secs?: number | null
    call_duration_secs: number
    queue_wait_secs?: number | null
    cost?: number | null
    cost_fiat?: number | null
    termination_reason?: string
    main_language?: string | null
    text_only?: boolean
    authorization_method?: string
    conversation_initiation_source?: string
    error?: { code: number; reason?: string | null } | null
    warnings?: string[]
    phone_call?: {
      type?: string
      direction?: 'inbound' | 'outbound'
      phone_number_id?: string
      agent_number?: string
      external_number?: string
      call_sid?: string
    } | null
    charging?: { is_burst?: boolean; tier?: string | null; dev_discount?: boolean; llm_price?: number | null; platform_price?: number | null } | null
    features_usage?: Record<string, unknown> | null
    feedback?: { type?: string | null; overall_score?: 'like' | 'dislike' | null } | null
  }
  analysis?: {
    call_successful?: 'success' | 'failure' | 'unknown'
    call_success_score?: number | null
    transcript_summary?: string
    call_summary_title?: string | null
    evaluation_criteria_results?: Record<string, { criteria_id?: string; result?: string; rationale?: string }>
    data_collection_results?: Record<string, { data_collection_id?: string; value?: unknown; rationale?: string }>
  } | null
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null
  has_audio: boolean
  has_user_audio?: boolean
  has_response_audio?: boolean
}

export interface ListConversationsParams {
  /** REQUIRED: the org's own ElevenLabs agent id (without it the listing spans every tenant). */
  agentId: string
  /** dynamic_variable_params, repeatable: `name:op:value` (op eq|neq|gt|gte|lt|lte|in). */
  dynamicVariableParams?: string[]
  callStartAfterUnix?: number
  callStartBeforeUnix?: number
  excludeStatuses?: ELConversationStatus[]
  cursor?: string | null
  pageSize?: number
  /** By call start time; the provider default is 'desc' (newest first). */
  sortDirection?: 'asc' | 'desc'
}

export function listConversations(params: ListConversationsParams, ctx?: Ctx) {
  if (!params.agentId) throw new Error('listConversations requires the org agent id')
  return req<ELConversationsPage>('conversations.list', '/v1/convai/conversations', {
    query: {
      agent_id: params.agentId,
      dynamic_variable_params: params.dynamicVariableParams,
      call_start_after_unix: params.callStartAfterUnix,
      call_start_before_unix: params.callStartBeforeUnix,
      exclude_statuses: params.excludeStatuses,
      cursor: params.cursor ?? undefined,
      page_size: Math.max(1, Math.min(params.pageSize ?? 30, CONVERSATIONS_MAX_PAGE_SIZE)),
      // Summaries are not needed: the details call carries everything we store.
      summary_mode: 'exclude',
      sort_direction: params.sortDirection,
    },
    ctx,
  })
}

export function getConversation(conversationId: string, ctx?: Ctx) {
  return req<ELConversationDetails>('conversations.get', `/v1/convai/conversations/${encodeURIComponent(conversationId)}`, { ctx })
}

/** Our calls.id as echoed in the conversation's dynamic variables (`ntv_call_id`). */
export function dynamicVariable(details: Pick<ELConversationDetails, 'conversation_initiation_client_data'>, name: string): string | null {
  const v = details.conversation_initiation_client_data?.dynamic_variables?.[name]
  return typeof v === 'string' && v ? v : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Conversations of `agentId` whose dynamic variable `ntv_call_id` equals
 * `callId`, each confirmed through GET (agent_id and the echoed id must
 * match). Newest first. register-call never returns the conversation id, so
 * this is how an app-routed call finds its conversation.
 */
export async function findConversationsByCallId(
  agentId: string,
  callId: string,
  opts: { callStartAfterUnix?: number; callStartBeforeUnix?: number; ctx?: Ctx; max?: number } = {},
): Promise<ELConversationDetails[]> {
  if (!UUID.test(callId)) throw new Error('findConversationsByCallId: callId must be a UUID')
  const page = await listConversations(
    {
      agentId,
      dynamicVariableParams: [`ntv_call_id:eq:${callId.toLowerCase()}`],
      callStartAfterUnix: opts.callStartAfterUnix,
      callStartBeforeUnix: opts.callStartBeforeUnix,
      pageSize: 5,
    },
    opts.ctx,
  )
  const out: ELConversationDetails[] = []
  const candidates = (page.conversations ?? [])
    .filter((c) => c.agent_id === agentId)
    .sort((a, b) => b.start_time_unix_secs - a.start_time_unix_secs)
    .slice(0, opts.max ?? 3)
  for (const c of candidates) {
    const details = await getConversation(c.conversation_id, opts.ctx)
    if (details.agent_id !== agentId) continue
    if ((dynamicVariable(details, 'ntv_call_id') ?? '').toLowerCase() !== callId.toLowerCase()) continue
    out.push(details)
  }
  return out
}

export type ConversationFeedback = 'like' | 'dislike' | null

/** POST /v1/convai/conversations/{id}/feedback (UserFeedbackScore; null clears). Setting a value is idempotent. */
export function sendConversationFeedback(conversationId: string, feedback: ConversationFeedback, ctx?: Ctx) {
  return req<unknown>('conversations.feedback', `/v1/convai/conversations/${encodeURIComponent(conversationId)}/feedback`, {
    method: 'POST',
    body: { feedback },
    idempotent: true,
    ctx,
  })
}

/**
 * POST /v1/convai/conversations/{id}/analysis/run: re-runs evaluation and data
 * collection with the agent's CURRENT settings and returns the conversation.
 * Billed to the platform (analysis LLM): never retried.
 */
export function runConversationAnalysis(conversationId: string, ctx?: Ctx) {
  return req<ELConversationDetails>('conversations.analysis_run', `/v1/convai/conversations/${encodeURIComponent(conversationId)}/analysis/run`, {
    method: 'POST',
    retry: NO_RETRY,
    timeoutMs: 60_000,
    ctx,
  })
}

/**
 * GET /v1/convai/analytics/live-count. Without agentId the count is
 * WORKSPACE-wide (every tenant): admin use only.
 */
export function liveCount(params: { agentId?: string } = {}, ctx?: Ctx) {
  return req<{ count: number }>('analytics.live_count', '/v1/convai/analytics/live-count', {
    query: { agent_id: params.agentId },
    timeoutMs: 5_000,
    ctx,
  })
}

/** AgentTopicResponseModel (subset). */
export interface ELAgentTopic {
  topic_id: string
  label: string
  description: string
  conversation_count: number
  parent_topic_id?: string | null
  success_rate?: number | null
}

export interface ELAgentTopicsPage {
  topics: ELAgentTopic[]
  window_start_unix_secs: number
  window_end_unix_secs: number
  aggregated_run_count?: number
  has_more?: boolean
  next_cursor?: string | null
}

/** GET /v1/convai/agents/{agent_id}/topics (the org's own agent only). */
export function agentTopics(
  agentId: string,
  params: { pageSize?: number; fromUnixSecs?: number; toUnixSecs?: number } = {},
  ctx?: Ctx,
) {
  return req<ELAgentTopicsPage>('agents.topics', `/v1/convai/agents/${encodeURIComponent(agentId)}/topics`, {
    query: {
      page_size: params.pageSize ? Math.max(1, Math.min(params.pageSize, 100)) : undefined,
      sort_by: 'conversations',
      sort_direction: 'desc',
      from_unix_secs: params.fromUnixSecs,
      to_unix_secs: params.toUnixSecs,
      // The per-criteria breakdown dominates the payload; success_rate is returned anyway.
      include_evaluation_criteria: false,
    },
    ctx,
  })
}
