// Workflow domain types shared by the executor (server), the API routes and the
// builder (client). No server imports here: client components use it directly.

import type { CallDirection, CallOutcome, IntegrationType, Plan } from '@/types'

// ─── Triggers ─────────────────────────────────────────────────────────────────

// call_started and voicemail_left are allowed by the database CHECK but nothing
// fires them, so they are never offered.
export const TRIGGER_TYPES = ['call_ended', 'call_missed', 'sentiment_negative', 'keyword_detected'] as const
export type TriggerType = (typeof TRIGGER_TYPES)[number]

// ─── Actions ──────────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'send_webhook',
  'notify_slack',
  'send_sms',
  'add_tag',
  'wait',
  'send_email',
  'add_to_sheet',
  'create_calendar_event',
  'create_doc',
  'save_to_drive',
] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export type GoogleActionType = 'send_email' | 'add_to_sheet' | 'create_calendar_event' | 'create_doc' | 'save_to_drive'
export type GoogleIntegrationType = Exclude<IntegrationType, 'webhook'>

/** The Google connection each Google step needs. */
export const GOOGLE_ACTION_INTEGRATION: Record<GoogleActionType, GoogleIntegrationType> = {
  send_email: 'gmail',
  add_to_sheet: 'google_sheets',
  create_calendar_event: 'google_calendar',
  create_doc: 'google_docs',
  save_to_drive: 'google_drive',
}

export function isGoogleAction(type: ActionType): type is GoogleActionType {
  return type in GOOGLE_ACTION_INTEGRATION
}

/** Steps a "Send test" really runs; everything else would touch callers, calls or Google. */
export const TESTABLE_ACTION_TYPES: readonly ActionType[] = ['send_webhook', 'notify_slack']

export const MAX_WORKFLOW_ACTIONS = 10

/** Stored shape of one step (workflows.actions[]). Config is validated per type. */
export interface StoredWorkflowAction {
  id: string
  type: ActionType
  config: Record<string, unknown>
}

/** A workflow as the dashboard sees it (no signing secret). */
export interface WorkflowSummary {
  id: string
  name: string
  description: string | null
  trigger: TriggerType
  trigger_config: { keyword?: string }
  actions: StoredWorkflowAction[]
  enabled: boolean
  runs: number
  successful_runs: number
  last_run_at: string | null
  created_at: string
  updated_at: string | null
}

export interface WorkflowWithSecret extends WorkflowSummary {
  /** HMAC-SHA256 key for webhook deliveries. Only returned to the signed-in owner. */
  signing_secret: string | null
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'running' | 'completed' | 'failed'

/** One step's outcome, stored in workflow_runs.results. Never contains URLs, tokens or secrets. */
export interface ActionResult {
  action_id: string
  action_type: ActionType | string
  success: boolean
  /** The step didn't run (an earlier step failed, or it isn't part of a test). */
  skipped?: boolean
  /** Plain-language outcome for the owner. */
  message: string
  attempts: number
  duration_ms: number
  /** HTTP status of the last attempt, for webhook and Slack steps. */
  status_code?: number | null
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  call_id: string | null
  status: RunStatus
  results: ActionResult[]
  error: string | null
  started_at: string
  completed_at: string | null
  call: { id: string; caller_number: string | null; from_number: string | null; started_at: string | null } | null
}

export interface WorkflowTestResult {
  /** Which call the test used. */
  source: 'latest_call' | 'sample'
  call_started_at: string | null
  ok: boolean
  results: ActionResult[]
}

// ─── Call context ─────────────────────────────────────────────────────────────

export interface WorkflowTranscriptTurn {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs?: number
}

/**
 * What callers pass to executeWorkflows. Every field is optional: when call_id
 * is set the executor loads the stored call (org-scoped) and fills anything
 * missing, so post-call code only needs to pass what it just computed.
 */
export interface CallContext {
  call_id?: string | null
  /** Legacy: the org now comes from executeWorkflows(orgId, …); a mismatch aborts the run. */
  org_id?: string
  /** Legacy name for the provider call id; defaults to provider_call_id ?? call id. */
  conversation_id?: string | null
  provider_call_id?: string | null
  agent_name?: string | null
  caller_name?: string | null
  /** The other party: the caller on inbound calls. */
  caller_number?: string | null
  from_number?: string | null
  to_number?: string | null
  direction?: CallDirection | string
  duration_seconds?: number | null
  status?: string | null
  sentiment?: string | null
  summary?: string | null
  outcome?: CallOutcome | null
  intent?: string | null
  tags?: string[] | null
  extracted?: Record<string, string> | null
  transcript?: { role: string; message: string; time_in_call_secs?: number }[] | null
  started_at?: string | null
  ended_at?: string | null
  is_test?: boolean
}

/** CallContext after merging with the stored call: every field present. */
export interface WorkflowCallData {
  call_id: string | null
  conversation_id: string | null
  agent_name: string | null
  caller_name: string | null
  caller_number: string | null
  from_number: string | null
  to_number: string | null
  direction: CallDirection
  duration_seconds: number
  status: string
  sentiment: string | null
  summary: string | null
  outcome: CallOutcome | null
  intent: string | null
  tags: string[]
  extracted: Record<string, string>
  transcript: WorkflowTranscriptTurn[]
  started_at: string | null
  ended_at: string | null
  is_test: boolean
}

export interface WorkflowOrgData {
  id: string
  name: string | null
  timezone: string
  plan: Plan
}

/** The number to text or show as "the caller": the other party of the call. */
export function customerNumber(call: Pick<WorkflowCallData, 'direction' | 'caller_number' | 'from_number' | 'to_number'>): string | null {
  if (call.direction === 'outbound') return call.to_number ?? call.caller_number
  return call.from_number ?? call.caller_number
}
