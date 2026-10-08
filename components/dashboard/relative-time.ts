/**
 * One compact "time ago" for every dashboard card (recent calls, live activity,
 * messages), so the same call never reads "2 minutes ago" in one card and
 * "1m ago" in the next. Always rounds down: "just now", "5 min ago", "2 h ago",
 * "3 d ago", then the date ("Oct 3") from a week on.
 */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return '—'
  const minutes = Math.floor(Math.max(0, now - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
