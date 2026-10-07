/**
 * The value workflows and exports received as "sentiment" before
 * calls.sentiment stopped being derived from the AI verdict (call_successful).
 * Older rows keep their stored sentiment; newer rows fall back to this.
 */
export function legacySentimentFromVerdict(verdict: unknown): string | null {
  if (verdict === 'success') return 'positive'
  if (verdict === 'failure') return 'negative'
  if (verdict === 'unknown') return 'neutral'
  return null
}
