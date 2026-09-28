// Keyword trigger matching. Pure and client-safe.
//
// Rules the owner can predict:
// - Case never matters.
// - Whole words or phrases only: "cancel" matches "please cancel it" but not
//   "cancellation". Spaces inside a phrase match any run of whitespace.
// - A keyword typed without accents also matches accented speech ("urgenta"
//   matches "urgență"); a keyword typed with accents must match them exactly.
// - Romanian ş/ţ (cedilla) and ș/ț (comma below) are the same letter.
// - Scripts written without spaces between words (Chinese, Japanese, Thai…)
//   match anywhere, since word boundaries can't be seen in the text.
// - Both sides of the call are searched, one turn at a time.

export const MAX_KEYWORDS = 10
export const MAX_KEYWORD_LENGTH = 60

// Only the Latin combining accents block, so Devanagari vowel signs or Japanese
// voicing marks (also "marks" in Unicode) are never stripped.
const LATIN_COMBINING_MARKS = /[̀-ͯ]/g

const NO_WORD_SPACES = new RegExp(
  '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Thai}\\p{Script=Lao}\\p{Script=Khmer}\\p{Script=Myanmar}]',
  'u'
)

function fold(text: string, stripAccents: boolean): string {
  let value = text
    .normalize('NFC')
    .replace(/ş/g, 'ș') // ş → ș
    .replace(/Ş/g, 'Ș') // Ş → Ș
    .replace(/ţ/g, 'ț') // ţ → ț
    .replace(/Ţ/g, 'Ț') // Ţ → Ț
    .toLowerCase()
  if (stripAccents) value = value.normalize('NFD').replace(LATIN_COMBINING_MARKS, '').normalize('NFC')
  return value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "pricing, refund\nemergency" → ['pricing', 'refund', 'emergency'] (trimmed, deduped, capped). */
export function parseKeywords(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string') return []
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const part of raw.split(/[,;\n]/)) {
    const keyword = part.replace(/\s+/g, ' ').trim()
    if (!keyword) continue
    const key = fold(keyword, false)
    if (seen.has(key)) continue
    seen.add(key)
    keywords.push(keyword.slice(0, MAX_KEYWORD_LENGTH))
    if (keywords.length === MAX_KEYWORDS) break
  }
  return keywords
}

/**
 * Why a keyword list can't be saved, or null when it can. parseKeywords would
 * otherwise trim long entries and drop extras without the owner noticing.
 */
export function keywordListIssue(raw: string | null | undefined): string | null {
  const parts = typeof raw === 'string' ? raw.split(/[,;\n]/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean) : []
  if (parts.length === 0) return 'Enter the word or phrase to listen for'
  if (parts.some((part) => part.length > MAX_KEYWORD_LENGTH)) {
    return `Keep each word or phrase under ${MAX_KEYWORD_LENGTH} characters`
  }
  if (new Set(parts.map((part) => fold(part, false))).size > MAX_KEYWORDS) {
    return `Listen for at most ${MAX_KEYWORDS} words or phrases`
  }
  return null
}

export interface KeywordMatcher {
  keyword: string
  test(text: string): boolean
}

export function compileKeyword(keyword: string): KeywordMatcher {
  const trimmed = keyword.replace(/\s+/g, ' ').trim()
  const exactAccents = fold(trimmed, false) !== fold(trimmed, true)
  const needle = fold(trimmed, !exactAccents)

  if (!needle) return { keyword, test: () => false }

  if (NO_WORD_SPACES.test(needle)) {
    return { keyword, test: (text) => fold(text, !exactAccents).includes(needle) }
  }

  const body = needle.split(' ').map(escapeRegExp).join('\\s+')
  // A letter, digit or combining mark next to the match means it's part of a longer word.
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${body}(?![\\p{L}\\p{N}\\p{M}])`, 'u')
  return { keyword, test: (text) => pattern.test(fold(text, !exactAccents)) }
}

export interface KeywordMatch {
  keyword: string
  role: 'agent' | 'user'
  turn_index: number
}

/** First keyword found in any turn, or null. */
export function findKeywordMatch(
  turns: readonly { role: string; message: string }[],
  keywords: readonly string[]
): KeywordMatch | null {
  if (keywords.length === 0 || turns.length === 0) return null
  const matchers = keywords.map(compileKeyword)
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index]
    if (typeof turn?.message !== 'string' || !turn.message) continue
    for (const matcher of matchers) {
      if (matcher.test(turn.message)) {
        return { keyword: matcher.keyword, role: turn.role === 'agent' ? 'agent' : 'user', turn_index: index }
      }
    }
  }
  return null
}
