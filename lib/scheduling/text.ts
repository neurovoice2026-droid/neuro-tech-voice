// Loose text matching for things callers say out loud: service names, team
// member names and roles. Speech-to-text drops diacritics, changes case and
// adds filler words, so comparisons run on a normalised form. Pure.

/** "Șef de tură!" → "sef de tura". Letters and digits of every script survive. */
export function normalizeForMatch(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function matchTokens(value: string | null | undefined): string[] {
  const normalized = normalizeForMatch(value)
  return normalized ? normalized.split(' ') : []
}

/** Levenshtein distance, early exit once it exceeds `max`. */
export function editDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[b.length]
}

/** 1 for identical strings, 0 for nothing in common. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest
}

/**
 * Whether a freed slot for `offered` suits someone waiting for `wanted`. An
 * unspecified service on either side matches anything.
 */
export function servicesMatch(wanted: string | null | undefined, offered: string | null | undefined): boolean {
  const a = normalizeForMatch(wanted)
  const b = normalizeForMatch(offered)
  if (!a || !b) return true
  if (a === b) return true
  const aTokens = matchTokens(a)
  const bTokens = matchTokens(b)
  return containsTokens(aTokens, bTokens) || containsTokens(bTokens, aTokens) || similarity(a, b) >= 0.8
}

/** True when every token of `needle` appears in `haystack` (as whole tokens). */
export function containsTokens(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false
  const set = new Set(haystack)
  return needle.every((token) => set.has(token))
}
