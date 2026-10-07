// Template variables for one call, as the workflow executor fills them:
// every variable the builder documents (lib/workflows/templates.ts
// TEMPLATE_VARIABLES, plus conversation_id and caller_email), and every
// data-collection field by its id ({{callback_number}}, {{reason_for_call}},
// custom fields). An unknown variable renders as an empty string, so an email
// never shows a literal "{{outcome}}". Pure.

import { CALL_OUTCOMES, type CallOutcome } from '@/types'
import { buildTemplateVars } from './templates'
import type { WorkflowCallData } from './types'
import type { CallContext } from './executor'

const AI_OUTCOME_LABEL: Record<string, string> = { success: 'Successful', failure: 'Not successful', unknown: 'Unclear' }

function asOutcome(v: string | null | undefined): CallOutcome | null {
  return typeof v === 'string' && (CALL_OUTCOMES as readonly string[]).includes(v) ? (v as CallOutcome) : null
}

/** CallContext (post-call) → the WorkflowCallData shape templates.ts renders. */
export function workflowCallData(ctx: CallContext): WorkflowCallData {
  const collected = ctx.collected ?? {}
  return {
    call_id: ctx.call_id ?? null,
    conversation_id: ctx.conversation_id ?? null,
    agent_name: ctx.agent_name ?? null,
    caller_name: collected.caller_name ?? null,
    caller_number: ctx.caller_number,
    from_number: ctx.from_number ?? null,
    to_number: ctx.to_number ?? null,
    direction: ctx.direction === 'outbound' ? 'outbound' : 'inbound',
    duration_seconds: ctx.duration_seconds,
    status: ctx.status,
    sentiment: ctx.sentiment,
    summary: ctx.summary,
    outcome: asOutcome(ctx.outcome),
    intent: collected.reason_for_call ?? null,
    tags: [],
    extracted: { ...collected, ...(collected.caller_name ? { name: collected.caller_name } : {}) },
    transcript: ctx.transcript.map((t) => ({ role: t.role === 'agent' ? 'agent' : 'user', message: t.message })),
    started_at: ctx.started_at,
    ended_at: ctx.ended_at ?? null,
    is_test: false,
  }
}

/** Every variable value for one call (data-collection ids never override a documented variable). */
export function callTemplateVars(ctx: CallContext, now: Date = new Date()): Record<string, string> {
  const vars = buildTemplateVars(workflowCallData(ctx), { name: ctx.business_name ?? null, timezone: ctx.timezone ?? 'UTC' }, now)
  vars.summary_title = ctx.summary_title ?? ''
  vars.ai_outcome = ctx.call_successful ? (AI_OUTCOME_LABEL[ctx.call_successful] ?? '') : ''
  for (const [key, value] of Object.entries(ctx.collected ?? {})) {
    const k = key.toLowerCase()
    if (!(k in vars)) vars[k] = value
  }
  return vars
}
