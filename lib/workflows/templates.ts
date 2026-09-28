// {{variable}} templates for Slack messages, texts, emails and document titles.
// Pure and client-safe: the builder shows the same variables it validates.

import { maskPhone, isE164 } from '@/lib/phone/e164'
import type { CallOutcome } from '@/types'
import { customerNumber, type WorkflowCallData, type WorkflowOrgData } from './types'

export interface TemplateVariable {
  key: string
  label: string
  /** Shown in the chip tooltip and the preview. */
  example: string
}

export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  { key: 'caller_number', label: 'Caller number', example: '+40 712 345 678' },
  { key: 'caller_name', label: 'Caller name', example: 'Maria Popescu' },
  { key: 'summary', label: 'Call summary', example: 'Asked to move Thursday’s appointment to Friday morning.' },
  { key: 'outcome', label: 'Outcome', example: 'Booked' },
  { key: 'sentiment', label: 'Sentiment', example: 'positive' },
  { key: 'intent', label: 'Reason for calling', example: 'reschedule appointment' },
  { key: 'tags', label: 'Tags', example: 'follow-up, vip' },
  { key: 'duration', label: 'Duration', example: '3m 05s' },
  { key: 'direction', label: 'Direction', example: 'inbound' },
  { key: 'date', label: 'Date', example: '17 Sep 2026' },
  { key: 'time', label: 'Time', example: '14:05' },
  { key: 'agent_name', label: 'Agent name', example: 'Ana' },
  { key: 'business_name', label: 'Business name', example: 'Your business' },
  { key: 'call_id', label: 'Call id', example: '9f1c2e4a-…' },
] as const

/** Old names kept working for workflows saved before the builder had chips. */
const ALIASES: Record<string, string> = {
  caller: 'caller_number',
  agent: 'agent_name',
  call_summary: 'summary',
}

const KNOWN_KEYS = new Set<string>([...TEMPLATE_VARIABLES.map((v) => v.key), 'conversation_id', 'caller_email'])

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

function canonicalKey(raw: string): string {
  const key = raw.toLowerCase()
  return ALIASES[key] ?? key
}

/** Variable names used in a template that the executor doesn't know (typos). */
export function unknownTemplateVariables(template: string): string[] {
  const unknown = new Set<string>()
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN_KEYS.has(canonicalKey(match[1]))) unknown.add(match[1])
  }
  return [...unknown]
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  opts?: { escape?: (value: string) => string }
): string {
  const escape = opts?.escape ?? ((value: string) => value)
  return template.replace(VARIABLE_PATTERN, (_match, name: string) => {
    const value = vars[canonicalKey(name)]
    return value === undefined ? '' : escape(value)
  })
}

/**
 * Slack treats &, < and > as control characters (<!channel>, <url|label>), so
 * call data is escaped. The owner's own template text is left alone on purpose.
 */
export function escapeSlackText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  answered: 'Answered',
  message_taken: 'Message taken',
  transferred: 'Transferred',
  flagged: 'Flagged',
  missed: 'Missed',
  spam: 'Spam',
  other: 'Other',
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest}s`
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

function safeTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone })
    return timezone
  } catch {
    return 'UTC'
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "17 Sep 2026" and "14:05" in the organisation's time zone. Built from numeric
 * parts so the text is identical in every runtime (ICU month abbreviations vary).
 */
export function formatDateParts(date: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timezone),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const month = MONTHS[Number(get('month')) - 1] ?? get('month')
  return {
    date: `${Number(get('day'))} ${month} ${get('year')}`,
    time: `${get('hour').padStart(2, '0')}:${get('minute').padStart(2, '0')}`,
  }
}

function humanIntent(intent: string | null): string {
  return intent ? intent.replace(/_/g, ' ').trim() : ''
}

/** Collapses the blank gaps an empty variable leaves in one-line text (titles, subjects). */
export function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The value of every variable for one call. Unknown values are empty strings. */
export function buildTemplateVars(
  call: WorkflowCallData,
  org: Pick<WorkflowOrgData, 'name' | 'timezone'>,
  now: Date = new Date()
): Record<string, string> {
  const startedAt = call.started_at ? new Date(call.started_at) : now
  const when = formatDateParts(Number.isNaN(startedAt.getTime()) ? now : startedAt, org.timezone)
  const number = customerNumber(call)
  return {
    caller_number: number ?? 'unknown',
    caller_name: call.caller_name ?? call.extracted.name ?? '',
    caller_email: call.extracted.email ?? '',
    summary: call.summary ?? '',
    outcome: call.outcome ? OUTCOME_LABELS[call.outcome] : '',
    sentiment: call.sentiment ?? 'n/a',
    intent: humanIntent(call.intent),
    tags: call.tags.join(', '),
    duration: formatDuration(call.duration_seconds),
    direction: call.direction,
    date: when.date,
    time: when.time,
    agent_name: call.agent_name ?? '',
    business_name: org.name ?? '',
    call_id: call.call_id ?? '',
    conversation_id: call.conversation_id ?? call.call_id ?? '',
  }
}

/** Same as buildTemplateVars but with the number masked, for previews in the dashboard. */
export function previewTemplateVars(call: WorkflowCallData, org: Pick<WorkflowOrgData, 'name' | 'timezone'>): Record<string, string> {
  const vars = buildTemplateVars(call, org)
  const number = customerNumber(call)
  if (number && isE164(number)) vars.caller_number = maskPhone(number)
  return vars
}

/** Default Slack text; matches what the product page shows. */
export const DEFAULT_SLACK_MESSAGE = ':telephone_receiver: {{direction}} call from {{caller_number}} ({{sentiment}}). {{summary}}'

export const DEFAULT_SMS_MESSAGE = 'Thanks for calling {{business_name}}. We have your details and will get back to you soon.'

export const DEFAULT_EMAIL_SUBJECT = 'Call from {{caller_number}}: {{outcome}}'

export const DEFAULT_EMAIL_BODY = [
  'New call handled by {{agent_name}} on {{date}} at {{time}}.',
  '',
  'Caller: {{caller_name}} {{caller_number}}',
  'Outcome: {{outcome}}',
  'Sentiment: {{sentiment}}',
  'Duration: {{duration}}',
  '',
  'Summary:',
  '{{summary}}',
].join('\n')

export const DEFAULT_EVENT_TITLE = 'Call back {{caller_number}}'

export const DEFAULT_DOC_TITLE = 'Call report {{date}} {{time}} {{caller_number}}'
