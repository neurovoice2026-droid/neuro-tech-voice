// {{variable}} references in tenant-authored text (system prompt, first
// message, voicemail message, transfer texts, after-hours message, custom
// variable values). ElevenLabs substitutes every {{name}} it knows, so a
// tenant could otherwise make the agent speak the per-call token, the
// conversation id or the conversation history, or send secret__ values to
// the LLM. Two layers: the zod schemas reject such text with a clear message,
// and the agent builder strips whatever still reaches it (stored before this
// rule, or written by another path).
// Client-safe (no imports).

/** System variables tenant text may use (caller-facing facts, no identifiers or history). */
export const ALLOWED_SYSTEM_VARIABLES: ReadonlySet<string> = new Set([
  'system__caller_id',
  'system__called_number',
  'system__time',
  'system__time_utc',
  'system__timezone',
  'system__call_duration_secs',
])

// Same grammar for detection and stripping: optional spaces inside the braces.
const VARIABLE_RE = /\{\{\s*([^{}\s]{1,100})\s*\}\}/g

/** Whether tenant text may reference `name` ({{ntv_*}}, {{secret__*}} and most {{system__*}} are platform-only). */
export function isPlatformOnlyVariable(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (n.startsWith('ntv_') || n.startsWith('secret__')) return true
  if (n.startsWith('system__')) return !ALLOWED_SYSTEM_VARIABLES.has(n)
  return false
}

/** Distinct platform-only variable names referenced in `text`. */
export function forbiddenVariablesIn(text: string | null | undefined): string[] {
  if (!text) return []
  const out = new Set<string>()
  let rest = text
  // Also catch references that only appear once another one is removed.
  for (let i = 0; i < 20; i++) {
    for (const m of rest.matchAll(VARIABLE_RE)) if (isPlatformOnlyVariable(m[1])) out.add(m[1])
    const next = rest.replace(VARIABLE_RE, '')
    if (next === rest) break
    rest = next
  }
  return [...out]
}

/** Removes every platform-only {{reference}}; other text (and allowed variables) is kept. */
export function stripPlatformVariables(text: string): string
export function stripPlatformVariables(text: string | null): string | null
export function stripPlatformVariables(text: string | null): string | null {
  if (!text) return text
  let out = text
  // Removing one reference can join the text around it into a new one
  // ("{{ {{ntv_x}}ntv_call_token}}"): repeat until nothing changes.
  for (let i = 0; i < 20; i++) {
    const next = out.replace(VARIABLE_RE, (whole, name: string) => (isPlatformOnlyVariable(name) ? '' : whole))
    if (next === out) return out
    out = next
  }
  // Pathological input: drop every brace pair so nothing can be substituted.
  return out.replace(/\{\{|\}\}/g, '')
}

export const PLATFORM_VARIABLE_MESSAGE =
  'Platform variables such as {{ntv_…}}, {{secret__…}} or {{system__…}} cannot be used here. Allowed system variables: ' +
  [...ALLOWED_SYSTEM_VARIABLES].map((v) => `{{${v}}}`).join(', ') +
  '.'

/** zod refinement predicate: true when `text` references no platform-only variable. */
export function hasNoPlatformVariables(text: string | null | undefined): boolean {
  return forbiddenVariablesIn(text).length === 0
}
