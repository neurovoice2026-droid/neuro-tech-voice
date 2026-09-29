// The JSON body a "Send webhook" step delivers. Pure and client-safe so the
// builder's payload preview is exactly what the executor sends.
//
// Compatibility: every key sent before signing existed is still there with the
// same meaning (event, call.{id, conversation_id, caller_number, direction,
// duration_seconds, status, sentiment, summary, started_at}, timestamp). New
// keys are only added, never renamed.

import type { TriggerType, WorkflowCallData } from './types'

export const WEBHOOK_EVENT = 'workflow_triggered'

export const WEBHOOK_HEADERS = {
  event: 'X-NTV-Event',
  delivery: 'X-NTV-Delivery',
  signature: 'X-NTV-Signature',
  attempt: 'X-NTV-Attempt',
} as const

export interface WebhookPayload {
  event: typeof WEBHOOK_EVENT
  call: {
    id: string | null
    conversation_id: string | null
    caller_number: string | null
    direction: string
    duration_seconds: number
    status: string
    sentiment: string | null
    summary: string | null
    started_at: string | null
    ended_at: string | null
    from_number: string | null
    to_number: string | null
    outcome: string | null
    intent: string | null
    tags: string[]
    extracted: Record<string, string>
  }
  timestamp: string
  trigger: TriggerType
  agent: { name: string | null }
  workflow: { id: string; name: string }
  delivery_id: string
  /** True only for deliveries sent with the builder's "Send test" button. */
  test: boolean
}

export function buildWebhookPayload(input: {
  call: WorkflowCallData
  trigger: TriggerType
  workflow: { id: string; name: string }
  deliveryId: string
  test: boolean
  now?: Date
}): WebhookPayload {
  const { call } = input
  return {
    event: WEBHOOK_EVENT,
    call: {
      id: call.call_id,
      conversation_id: call.conversation_id ?? call.call_id,
      caller_number: call.caller_number,
      direction: call.direction,
      duration_seconds: call.duration_seconds,
      status: call.status,
      sentiment: call.sentiment,
      summary: call.summary,
      started_at: call.started_at,
      ended_at: call.ended_at,
      from_number: call.from_number,
      to_number: call.to_number,
      outcome: call.outcome,
      intent: call.intent,
      tags: call.tags,
      extracted: call.extracted,
    },
    timestamp: (input.now ?? new Date()).toISOString(),
    trigger: input.trigger,
    agent: { name: call.agent_name },
    workflow: { id: input.workflow.id, name: input.workflow.name },
    delivery_id: input.deliveryId,
    test: input.test,
  }
}

/**
 * A clearly fictional call used by "Send test" when the organisation has no
 * calls yet, and by the payload preview. Numbers are in the 555-01xx range.
 */
export function sampleCallData(now: Date = new Date()): WorkflowCallData {
  const started = new Date(now.getTime() - 4 * 60 * 1000)
  return {
    call_id: null,
    conversation_id: 'sample-call',
    agent_name: 'Your AI agent',
    caller_name: 'Sample Caller',
    caller_number: '+15555550142',
    from_number: '+15555550142',
    to_number: '+15555550100',
    direction: 'inbound',
    duration_seconds: 187,
    status: 'completed',
    sentiment: 'positive',
    summary: 'Sample call: the caller asked to book an appointment for Friday morning and left their name.',
    outcome: 'booked',
    intent: 'book_appointment',
    tags: ['sample'],
    extracted: { name: 'Sample Caller' },
    transcript: [
      { role: 'agent', message: 'Hello, thanks for calling. How can I help?', time_in_call_secs: 0 },
      { role: 'user', message: 'Hi, I’d like to book an appointment for Friday morning.', time_in_call_secs: 4 },
      { role: 'agent', message: 'Of course. Friday at 9:30 is free. Shall I book it?', time_in_call_secs: 9 },
      { role: 'user', message: 'Yes please.', time_in_call_secs: 14 },
    ],
    started_at: started.toISOString(),
    ended_at: new Date(started.getTime() + 187 * 1000).toISOString(),
    is_test: false,
  }
}
