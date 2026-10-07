// Values the agent collected during a call (calls.analysis.data, filled from
// the provider's data-collection results), as plain strings for workflow
// templates and payloads. Pure.

const KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
const MAX_VALUE = 500
const MAX_FIELDS = 40

/** analysis.data → { field_id: "value" } (null/empty values and odd keys are skipped). */
export function collectedValues(analysis: unknown): Record<string, string> {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return {}
  const data = (analysis as { data?: unknown }).data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_FIELDS) break
    if (!KEY.test(key)) continue
    let text: string | null = null
    if (typeof value === 'string') text = value.trim()
    else if (typeof value === 'number' && Number.isFinite(value)) text = String(value)
    else if (typeof value === 'boolean') text = value ? 'yes' : 'no'
    if (text) out[key] = text.slice(0, MAX_VALUE)
  }
  return out
}
