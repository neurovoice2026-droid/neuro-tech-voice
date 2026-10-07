import 'server-only'
// ElevenLabs workspace-level settings, verified against the official OpenAPI
// spec (2026-10). Platform/admin use only: these objects are shared by every
// tenant and are never shown to one.
//   GET   /v1/workspace/webhooks?include_usages=   → WorkspaceWebhookListResponseModel
//   PATCH /v1/workspace/webhooks/{webhook_id}      {is_disabled*, name*, retry_enabled, request_headers, events}
//   GET   /v1/convai/settings                       → GetConvAISettingsResponseModel
//   PATCH /v1/convai/settings                       PatchConvAISettingsRequest (workspace-wide!)
// Webhook secrets are returned only when a webhook is created; nothing here
// reads, stores or logs one.

import { req, type Ctx } from '../client'

/** WorkspaceWebhookResponseModel. retry_enabled is NOT returned (it can only be set). */
export interface ELWorkspaceWebhook {
  name: string
  webhook_id: string
  webhook_url: string
  is_disabled: boolean
  /** Set by ElevenLabs after repeated delivery failures (≥ 10 in a row, last success > 7 days ago). */
  is_auto_disabled: boolean
  created_at_unix: number
  /** WebhookAuthMethodType: hmac | oauth2 | mtls. */
  auth_type: string
  /** Only with include_usages (admins): e.g. "ConvAI Agent Settings", "ConvAI Settings". */
  usage?: Array<{ usage_type: string }> | null
  /** WorkspaceWebhookEventType (voice_library_removal_notice, speech_to_text, agent_qa, flows); not the post-call events. */
  events?: string[] | null
  most_recent_failure_error_code?: number | null
  most_recent_failure_timestamp?: number | null
}

export function listWorkspaceWebhooks(params: { includeUsages?: boolean } = {}, ctx?: Ctx) {
  return req<{ webhooks: ELWorkspaceWebhook[] }>('workspace.webhooks_list', '/v1/workspace/webhooks', {
    query: { include_usages: params.includeUsages === true ? true : undefined },
    ctx,
  })
}

/**
 * PATCH /v1/workspace/webhooks/{id}. `name` and `is_disabled` are required by
 * the spec (send the current name). `events` is the COMPLETE set of workspace
 * events and is never sent from here (it would unsubscribe other events).
 */
export function updateWorkspaceWebhook(webhookId: string, body: { name: string; is_disabled: boolean; retry_enabled?: boolean }, ctx?: Ctx) {
  return req<{ status: string }>('workspace.webhooks_update', `/v1/workspace/webhooks/${encodeURIComponent(webhookId)}`, {
    method: 'PATCH',
    body: {
      name: body.name,
      is_disabled: body.is_disabled,
      ...(body.retry_enabled === undefined ? {} : { retry_enabled: body.retry_enabled }),
    },
    idempotent: true,
    ctx,
  })
}

/** WebhookEventType of ConvAIWebhooks (post-call events). */
export type ELPostCallEvent = 'transcript' | 'audio' | 'call_initiation_failure' | 'answering_machine_detection' | 'unredacted_transcript' | 'unredacted_audio'

/** GetConvAISettingsResponseModel (send_audio is deprecated and never written). */
export interface ELConvaiSettings {
  conversation_initiation_client_data_webhook?: { url: string; request_headers: Record<string, unknown> } | null
  webhooks?: {
    post_call_webhook_id?: string | null
    events?: ELPostCallEvent[]
    transcript_format?: 'json' | 'opentelemetry'
    exclude_transcript?: boolean
    send_audio?: boolean | null
  }
  can_use_mcp_servers?: boolean
  /** 1–30, default 10. */
  rag_retention_period_days?: number
  /** 1–365; null = system default (30 days). */
  conversation_embedding_retention_days?: number | null
  default_livekit_stack?: 'standard' | 'static'
}

export function getConvaiSettings(ctx?: Ctx) {
  return req<ELConvaiSettings>('convai.settings_get', '/v1/convai/settings', { ctx })
}

/** Spec bounds of conversation_embedding_retention_days (exclusiveMinimum 0, maximum 365). */
export const EMBEDDING_RETENTION_MIN_DAYS = 1
export const EMBEDDING_RETENTION_MAX_DAYS = 365

/**
 * PATCH /v1/convai/settings. WORKSPACE-WIDE: changes every agent of every
 * tenant (and any other environment sharing the workspace). The caller sends
 * a read-modify-write body (lib/voice-providers/workspace-settings.ts), so a
 * PATCH that resets omitted fields to defaults cannot change anything else.
 */
export function updateConvaiSettings(body: ELConvaiSettings, ctx?: Ctx) {
  return req<ELConvaiSettings>('convai.settings_update', '/v1/convai/settings', { method: 'PATCH', body, idempotent: true, ctx })
}
