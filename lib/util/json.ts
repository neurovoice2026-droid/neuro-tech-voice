// JSON parsing that returns the failure instead of throwing, so callers decide
// how to report it (log, problem list, 400) — never a silent catch.
export type JsonParseResult = { ok: true; value: unknown } | { ok: false; error: string }

export function parseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'invalid JSON' }
  }
}
