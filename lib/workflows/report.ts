// Text the Google steps write (email MIME, sheet rows, documents, transcript
// files). Pure (Node Buffer only), so the formats are unit-tested without Google.

import { OUTCOME_LABELS, formatDateParts, formatDuration } from './templates'
import { customerNumber, type WorkflowCallData, type WorkflowOrgData } from './types'

// ─── Email ────────────────────────────────────────────────────────────────────

/** Header values can't carry line breaks (header injection) and are capped. */
function headerValue(value: string, max = 998): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

/** RFC 2047 encoded-word for non-ASCII subjects. */
export function encodeMimeHeader(value: string): string {
  const clean = headerValue(value)
  if (/^[\x20-\x7e]*$/.test(clean)) return clean
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`
}

function wrapBase64(value: string): string {
  return value.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd()
}

/** A plain-text UTF-8 email as the base64url "raw" string Gmail's send API takes. */
export function buildRawEmail(input: { to: string[]; subject: string; body: string }): string {
  const recipients = input.to.map((address) => headerValue(address, 254)).filter(Boolean)
  const message = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(input.body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64')),
  ].join('\r\n')
  return Buffer.from(message, 'utf8').toString('base64url')
}

// ─── Call report ──────────────────────────────────────────────────────────────

function whenLabel(call: WorkflowCallData, org: Pick<WorkflowOrgData, 'timezone'>): string {
  if (!call.started_at) return 'Unknown'
  const date = new Date(call.started_at)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const parts = formatDateParts(date, org.timezone)
  return `${parts.date}, ${parts.time} (${org.timezone})`
}

export function callReportLines(call: WorkflowCallData, org: Pick<WorkflowOrgData, 'timezone' | 'name'>): string[] {
  const lines = [
    `When: ${whenLabel(call, org)}`,
    `Caller: ${[call.caller_name, customerNumber(call)].filter(Boolean).join(' ') || 'Unknown'}`,
    `Direction: ${call.direction}`,
    `Duration: ${formatDuration(call.duration_seconds)}`,
    `Outcome: ${call.outcome ? OUTCOME_LABELS[call.outcome] : 'Not analysed yet'}`,
    `Sentiment: ${call.sentiment ?? 'Unknown'}`,
  ]
  if (call.agent_name) lines.push(`Agent: ${call.agent_name}`)
  if (call.intent) lines.push(`Reason for calling: ${call.intent.replace(/_/g, ' ')}`)
  if (call.tags.length) lines.push(`Tags: ${call.tags.join(', ')}`)
  const details = Object.entries(call.extracted).filter(([, value]) => typeof value === 'string' && value.trim())
  if (details.length) {
    lines.push('', 'Details captured:')
    for (const [key, value] of details) lines.push(`- ${key.replace(/_/g, ' ')}: ${value}`)
  }
  lines.push('', 'Summary:', call.summary?.trim() || 'No summary for this call.')
  return lines
}

function clock(seconds: number | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--'
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function transcriptLines(call: WorkflowCallData): string[] {
  if (call.transcript.length === 0) return ['No transcript for this call.']
  const agent = call.agent_name || 'Agent'
  return call.transcript.map((turn) => `[${clock(turn.time_in_call_secs)}] ${turn.role === 'agent' ? agent : 'Caller'}: ${turn.message}`)
}

export function callReportDocument(
  call: WorkflowCallData,
  org: Pick<WorkflowOrgData, 'timezone' | 'name'>,
  opts: { includeTranscript: boolean }
): string {
  const lines = [`Call report${org.name ? ` for ${org.name}` : ''}`, '', ...callReportLines(call, org)]
  if (opts.includeTranscript) lines.push('', 'Transcript:', ...transcriptLines(call))
  return `${lines.join('\n')}\n`
}

export function transcriptFile(call: WorkflowCallData, org: Pick<WorkflowOrgData, 'timezone' | 'name'>): { name: string; content: string } {
  const started = call.started_at ? new Date(call.started_at) : new Date()
  const parts = formatDateParts(Number.isNaN(started.getTime()) ? new Date() : started, org.timezone)
  const number = customerNumber(call)
  const safeNumber = number ? number.replace(/[^\d+]/g, '') : 'unknown caller'
  const name = `Call ${parts.date} ${parts.time.replace(':', '.')} ${safeNumber}.txt`
  const content = [...callReportLines(call, org), '', 'Transcript:', ...transcriptLines(call)].join('\n')
  return { name, content: `${content}\n` }
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

export const SHEET_HEADER = [
  'Date', 'Time', 'Caller number', 'Caller name', 'Direction', 'Duration (seconds)',
  'Outcome', 'Sentiment', 'Reason for calling', 'Tags', 'Summary', 'Call id',
] as const

/**
 * One row per call. Written with valueInputOption RAW, so text that starts
 * with "=" (a summary is caller-influenced) stays text instead of a formula.
 */
export function sheetRow(call: WorkflowCallData, org: Pick<WorkflowOrgData, 'timezone'>): (string | number)[] {
  const started = call.started_at ? new Date(call.started_at) : null
  const parts = started && !Number.isNaN(started.getTime()) ? formatDateParts(started, org.timezone) : { date: '', time: '' }
  return [
    parts.date,
    parts.time,
    customerNumber(call) ?? '',
    call.caller_name ?? call.extracted.name ?? '',
    call.direction,
    call.duration_seconds,
    call.outcome ? OUTCOME_LABELS[call.outcome] : '',
    call.sentiment ?? '',
    call.intent ? call.intent.replace(/_/g, ' ') : '',
    call.tags.join(', '),
    call.summary ?? '',
    call.call_id ?? '',
  ]
}

/** 'Leads' → "'Leads'!A1"; no tab name → first tab. */
export function sheetRange(sheetName: string | undefined): string {
  const name = sheetName?.trim()
  return name ? `'${name.replace(/'/g, "''")}'!A1` : 'A1'
}

// ─── Google errors ────────────────────────────────────────────────────────────

/** Friendly message for a googleapis (gaxios) error; never the raw upstream text. */
export function googleErrorMessage(error: unknown, product: string): string {
  const e = error as { code?: unknown; status?: unknown; response?: { status?: number; data?: { error?: unknown } } }
  const status = typeof e?.response?.status === 'number' ? e.response.status : typeof e?.status === 'number' ? e.status : Number(e?.code)
  const data = e?.response?.data?.error
  const reason = typeof data === 'string' ? data : ''
  if (reason === 'invalid_grant' || status === 401) {
    return `Google access has expired or was removed. Reconnect ${product} on the Integrations page.`
  }
  if (status === 403) {
    return `Google didn’t allow this. Check that the connected Google account can open it, or reconnect ${product} on the Integrations page and approve every permission.`
  }
  if (status === 404) return `${product} couldn’t find what this step points to. Check the link or name in the step.`
  // Sheets answers 400 for a tab name that doesn't exist; Gmail for a recipient it won't accept.
  if (status === 400) return `${product} didn’t accept this step’s settings. Check the link, tab name or addresses in the step.`
  if (status === 429) return `Google was limiting requests, so this step didn’t run for this call.`
  if (typeof status === 'number' && status >= 500) return `${product} had a temporary problem, so this step didn’t run for this call.`
  const name = error instanceof Error ? error.name : ''
  const code = (error as { code?: unknown })?.code
  const message = error instanceof Error ? error.message : ''
  if (name === 'AbortError' || name === 'TimeoutError' || code === 'ETIMEDOUT' || /timeout|timed out/i.test(message)) {
    return `${product} took too long to answer, so this step didn’t run for this call.`
  }
  if (code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED') {
    return `We couldn’t reach ${product}, so this step didn’t run for this call.`
  }
  return `${product} couldn’t complete this step.`
}
