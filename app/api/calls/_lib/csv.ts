import type { ExportColumn } from './query'

// CSV/JSON export formatting. Pure, unit tested.

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  caller_number: 'Phone number',
  direction: 'Direction',
  duration_seconds: 'Duration (s)',
  status: 'Status',
  outcome: 'Outcome',
  intent: 'Intent',
  sentiment: 'Sentiment',
  tags: 'Tags',
  created_at: 'Date & time (UTC)',
  summary: 'AI summary',
  extracted: 'Lead details',
  transcript: 'Transcript',
  agent_name: 'Agent',
}

// A plain number (phone numbers, negative durations) can't run a formula, so
// it keeps its sign; anything else starting with a trigger character is text.
const NUMERIC_RE = /^[+-]?[\d\s().]*\d[\d\s().]*$/

/**
 * Spreadsheet formula-injection guard (OWASP CSV injection): cells that start
 * with = + - @ tab or carriage return are prefixed with a single quote, so
 * Excel and Sheets show them as text instead of evaluating them.
 */
export function guardFormula(value: string): string {
  if (!value) return value
  const first = value[0]
  if (first === '=' || first === '@' || first === '\t' || first === '\r') return `'${value}`
  if ((first === '+' || first === '-') && !NUMERIC_RE.test(value)) return `'${value}`
  return value
}

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : String(value)
  const guarded = guardFormula(text)
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export interface ExportCallRow {
  id: string
  caller_number: string | null
  direction: string
  duration_seconds: number | null
  status: string
  outcome: string | null
  intent: string | null
  sentiment: string | null
  tags: string[] | null
  started_at: string | null
  created_at: string
  summary: string | null
  extracted: Record<string, unknown> | null
  transcript: { role: string; message: string }[] | null
  agent_name: string | null
}

function transcriptText(transcript: ExportCallRow['transcript']): string {
  return (transcript ?? [])
    .filter((t) => t && typeof t.message === 'string')
    .map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
    .join('\n')
}

function extractedText(extracted: ExportCallRow['extracted']): string {
  if (!extracted || typeof extracted !== 'object') return ''
  return Object.entries(extracted)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

export function exportValue(row: ExportCallRow, column: ExportColumn): unknown {
  switch (column) {
    case 'created_at':
      return row.started_at ?? row.created_at
    case 'duration_seconds':
      return Number(row.duration_seconds) || 0
    case 'tags':
      return (row.tags ?? []).join('; ')
    case 'transcript':
      return transcriptText(row.transcript)
    case 'extracted':
      return extractedText(row.extracted)
    default:
      return row[column]
  }
}

/** UTF-8 BOM so Excel reads diacritics correctly; CRLF line endings per RFC 4180. */
export function toCsv(rows: ExportCallRow[], columns: ExportColumn[]): string {
  const header = columns.map((c) => csvCell(EXPORT_COLUMN_LABELS[c])).join(',')
  const lines = rows.map((row) => columns.map((c) => csvCell(exportValue(row, c))).join(','))
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`
}

export function toJsonRows(rows: ExportCallRow[], columns: ExportColumn[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { id: row.id }
    for (const column of columns) {
      if (column === 'transcript') out.transcript = row.transcript ?? []
      else if (column === 'extracted') out.extracted = row.extracted ?? {}
      else if (column === 'tags') out.tags = row.tags ?? []
      else if (column === 'created_at') out.started_at = row.started_at ?? row.created_at
      else out[column] = exportValue(row, column)
    }
    return out
  })
}
