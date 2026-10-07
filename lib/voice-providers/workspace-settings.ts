import 'server-only'
// Admin-only changes to the shared ElevenLabs workspace:
//   • the post-call webhook: re-enable it and turn delivery retries on
//     (PATCH /v1/workspace/webhooks/{id}; name and is_disabled are required,
//     events are never sent because they are the complete set);
//   • conversation_embedding_retention_days of /v1/convai/settings, aligned
//     with the platform privacy policy (read-modify-write, then read back).
// Both are dry runs unless the admin route says otherwise. WORKSPACE-WIDE:
// they affect every tenant and every environment sharing the workspace.
// Nothing returned here carries a secret or a request header value.

import type { Logger } from '@/lib/observability/logger'
import {
  EMBEDDING_RETENTION_MAX_DAYS,
  EMBEDDING_RETENTION_MIN_DAYS,
  getConvaiSettings,
  updateConvaiSettings,
  updateWorkspaceWebhook,
  type ELConvaiSettings,
} from '@/lib/elevenlabs/api/workspace'
import { checkPostCallWebhook, embeddingRetentionPolicyDays, type PostCallWebhookHealth } from './webhook-health'

export interface WebhookRepairPlan {
  webhook_id: string | null
  /** The PATCH that would be (or was) sent: current name, enabled, retries on. */
  patch: { name: string; is_disabled: boolean; retry_enabled?: boolean } | null
  reason: string | null
}

export function planWebhookRepair(health: PostCallWebhookHealth, opts: { enableRetries: boolean; reenable: boolean }): WebhookRepairPlan {
  if (!health.webhook_id || !health.webhook) {
    return { webhook_id: health.webhook_id, patch: null, reason: 'No post-call webhook was found in the workspace.' }
  }
  const wasDisabled = health.webhook.is_disabled || health.webhook.is_auto_disabled
  return {
    webhook_id: health.webhook_id,
    patch: {
      name: health.webhook.name,
      is_disabled: opts.reenable ? false : wasDisabled,
      ...(opts.enableRetries ? { retry_enabled: true } : {}),
    },
    reason: null,
  }
}

export async function repairPostCallWebhook(opts: { dryRun: boolean; enableRetries: boolean; reenable: boolean; log: Logger }) {
  const before = await checkPostCallWebhook(opts.log)
  const plan = planWebhookRepair(before, opts)
  if (opts.dryRun || !plan.patch || !plan.webhook_id) return { dry_run: opts.dryRun, applied: false, before, plan, after: null }
  await updateWorkspaceWebhook(plan.webhook_id, plan.patch)
  opts.log.warn('workspace.post_call_webhook_updated', { webhookId: plan.webhook_id, reenabled: plan.patch.is_disabled === false, retries: plan.patch.retry_enabled === true })
  const after = await checkPostCallWebhook(opts.log)
  return { dry_run: false, applied: true, before, plan, after }
}

/** Settings as an admin may see them: no header values, URL presence only. */
export function summarizeConvaiSettings(s: ELConvaiSettings) {
  return {
    initiation_webhook_configured: !!s.conversation_initiation_client_data_webhook?.url,
    post_call_webhook_id: s.webhooks?.post_call_webhook_id ?? null,
    post_call_events: s.webhooks?.events ?? [],
    transcript_format: s.webhooks?.transcript_format ?? null,
    rag_retention_period_days: s.rag_retention_period_days ?? null,
    conversation_embedding_retention_days: s.conversation_embedding_retention_days ?? null,
    can_use_mcp_servers: s.can_use_mcp_servers ?? null,
    default_livekit_stack: s.default_livekit_stack ?? null,
  }
}

/**
 * Read-modify-write body: everything read back, unchanged, except the
 * embedding retention. The deprecated send_audio is never written. The PATCH
 * semantics for omitted fields are undocumented, so nothing is omitted.
 */
export function embeddingRetentionBody(current: ELConvaiSettings, days: number): ELConvaiSettings {
  const body: ELConvaiSettings = { ...current, conversation_embedding_retention_days: days }
  if (current.webhooks) {
    const webhooks = { ...current.webhooks }
    delete webhooks.send_audio
    body.webhooks = webhooks
  }
  return body
}

const COMPARED: Array<keyof ReturnType<typeof summarizeConvaiSettings>> = [
  'initiation_webhook_configured', 'post_call_webhook_id', 'post_call_events', 'transcript_format',
  'rag_retention_period_days', 'can_use_mcp_servers', 'default_livekit_stack',
]

export async function alignEmbeddingRetention(opts: { dryRun: boolean; days?: number; log: Logger }) {
  const target = opts.days ?? embeddingRetentionPolicyDays()
  if (!Number.isInteger(target) || target < EMBEDDING_RETENTION_MIN_DAYS || target > EMBEDDING_RETENTION_MAX_DAYS) {
    throw new Error('embedding retention out of range')
  }
  const current = await getConvaiSettings()
  const before = summarizeConvaiSettings(current)
  const effective = current.conversation_embedding_retention_days ?? 30
  const change = { from: current.conversation_embedding_retention_days ?? null, to: target, effective_from: effective }
  if (opts.dryRun || current.conversation_embedding_retention_days === target) {
    return { dry_run: opts.dryRun, applied: false, unchanged: current.conversation_embedding_retention_days === target, before, change, after: null, other_fields_changed: [] as string[] }
  }
  await updateConvaiSettings(embeddingRetentionBody(current, target))
  const after = summarizeConvaiSettings(await getConvaiSettings())
  const otherChanged = COMPARED.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (otherChanged.length) opts.log.error('workspace.convai_settings_side_effects', null, { fields: otherChanged })
  opts.log.warn('workspace.embedding_retention_updated', { from: change.from, to: target })
  return { dry_run: false, applied: true, unchanged: false, before, change, after, other_fields_changed: otherChanged }
}
