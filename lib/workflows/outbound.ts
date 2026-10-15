import 'server-only'
// Outbound HTTP for the workflow steps that call an address the owner typed
// (send_webhook, notify_slack). The URL is tenant-supplied, and tenants can
// also write workflows directly under RLS, so every delivery goes through the
// commerce SSRF guard (lib/commerce/safe-fetch.ts): https only, no private /
// loopback / link-local / metadata addresses after DNS resolution, redirects
// never followed, a timeout and a response-size limit. Saving a workflow runs
// the same URL check so a bad address is refused up front; a Slack step must
// point at Slack's incoming-webhook host.

import { z } from 'zod'
import {
  StoreHttpError,
  UnsafeUrlError,
  assertSafeStoreUrl,
  safeFetch,
  type SafeFetchOptions,
  type SafeUrlOptions,
} from '@/lib/commerce/safe-fetch'
import { ACTION_TYPES, MAX_WORKFLOW_ACTIONS, type StoredWorkflowAction } from './types'

/** Workflows run after the call in the background: a slow endpoint must not hold that invocation. */
export const WORKFLOW_HTTP_TIMEOUT_MS = 10_000
/** Only the status is used; the cap bounds what an endpoint can make us read. */
export const WORKFLOW_HTTP_MAX_BYTES = 256 * 1024
export const SLACK_WEBHOOK_HOST = 'hooks.slack.com'
/** A JSON body goes with every delivery, so GET / HEAD / DELETE are not offered. */
export const WEBHOOK_METHODS = ['POST', 'PUT', 'PATCH'] as const
export type WebhookMethod = (typeof WEBHOOK_METHODS)[number]

export type HttpStepType = 'send_webhook' | 'notify_slack'

export function isWebhookMethod(method: string): method is WebhookMethod {
  return (WEBHOOK_METHODS as readonly string[]).includes(method)
}

// Runs before the shared guard so a non-Slack address never reaches DNS.
function assertSlackHost(type: HttpStepType, raw: string): void {
  if (type !== 'notify_slack') return
  const parsed = URL.canParse(raw) ? new URL(raw) : null
  if (!parsed || parsed.protocol !== 'https:' || parsed.hostname !== SLACK_WEBHOOK_HOST || parsed.port !== '') {
    throw new UnsafeUrlError(`Slack webhook URLs must start with https://${SLACK_WEBHOOK_HOST}/`)
  }
}

/** Validates a step URL for outbound use; throws UnsafeUrlError with a plain-language reason. */
export async function assertWorkflowUrl(type: HttpStepType, raw: string, opts: SafeUrlOptions = {}): Promise<URL> {
  assertSlackHost(type, raw)
  return assertSafeStoreUrl(raw, opts)
}

export type HttpStepOutcome =
  | { kind: 'response'; ok: boolean; status: number }
  /** The request was refused or did not complete; `message` is the reason for the owner, never the URL. */
  | { kind: 'error'; message: string }

/**
 * Sends one JSON request for a workflow step through the SSRF guard. Never
 * throws: a refused URL, a timeout, a redirect or a network failure comes back
 * as an error outcome for the run's results.
 */
export async function sendWorkflowRequest(
  type: HttpStepType,
  raw: string,
  payload: unknown,
  opts: Pick<SafeFetchOptions, 'lookup' | 'fetchImpl'> & { method?: WebhookMethod } = {},
): Promise<HttpStepOutcome> {
  try {
    assertSlackHost(type, raw)
    // safeFetch runs the shared URL guard (DNS included) itself.
    const res = await safeFetch(raw, {
      method: opts.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: WORKFLOW_HTTP_TIMEOUT_MS,
      maxBytes: WORKFLOW_HTTP_MAX_BYTES,
      lookup: opts.lookup,
      fetchImpl: opts.fetchImpl,
    })
    return { kind: 'response', ok: res.status >= 200 && res.status < 300, status: res.status }
  } catch (err) {
    return { kind: 'error', message: describeHttpError(err) }
  }
}

// safe-fetch words its errors for stores; a workflow step gets its own wording.
function describeHttpError(err: unknown): string {
  if (err instanceof UnsafeUrlError) return `URL not allowed (${err.reason})`
  if (err instanceof StoreHttpError) {
    switch (err.code) {
      case 'timeout':
        return `no answer within ${WORKFLOW_HTTP_TIMEOUT_MS / 1000}s`
      case 'redirect':
        return `the URL answered with a redirect (${err.status}), which is not followed; use the final https address`
      case 'too_large':
        return `the reply was larger than ${WORKFLOW_HTTP_MAX_BYTES / 1024} KB`
      case 'network':
        return 'the URL could not be reached'
      default:
        return 'the request failed'
    }
  }
  return err instanceof Error ? err.message : 'unknown'
}

// ─── Save-time validation ─────────────────────────────────────────────────────

const ActionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(ACTION_TYPES),
  config: z.record(z.string(), z.unknown()),
})
const ActionsSchema = z.array(ActionSchema).max(MAX_WORKFLOW_ACTIONS)

export type WorkflowActionsValidation =
  | { ok: true; actions: StoredWorkflowAction[] }
  | { ok: false; error: string; details?: Array<{ path: string; message: string }> }

/**
 * Checks workflows.actions before it is stored: the shape, and every webhook /
 * Slack URL through the same guard the executor uses (DNS included). An empty
 * or missing URL is left to the executor, which reports it on the run.
 */
export async function validateWorkflowActions(raw: unknown, opts: SafeUrlOptions = {}): Promise<WorkflowActionsValidation> {
  const parsed = ActionsSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Some workflow steps are invalid.',
      details: parsed.error.issues.slice(0, 10).map((i) => ({ path: ['actions', ...i.path].join('.'), message: i.message })),
    }
  }
  for (const [index, action] of parsed.data.entries()) {
    if (action.type !== 'send_webhook' && action.type !== 'notify_slack') continue
    const label = action.type === 'send_webhook' ? 'webhook URL' : 'Slack webhook URL'
    // Same keys the executor reads.
    const url = action.type === 'send_webhook' ? action.config.url : action.config.webhook_url ?? action.config.url
    if (url !== undefined && typeof url !== 'string') return { ok: false, error: `The ${label} in step ${index + 1} must be text.` }
    if (action.type === 'send_webhook' && action.config.method !== undefined) {
      const method = action.config.method
      if (typeof method !== 'string' || !isWebhookMethod(method.toUpperCase())) {
        return { ok: false, error: `The webhook method in step ${index + 1} must be POST, PUT or PATCH.` }
      }
    }
    if (!url) continue
    try {
      await assertWorkflowUrl(action.type, url, opts)
    } catch (err) {
      if (err instanceof UnsafeUrlError) return { ok: false, error: `The ${label} in step ${index + 1} is not allowed: ${err.reason}.` }
      throw err
    }
  }
  return { ok: true, actions: parsed.data }
}
