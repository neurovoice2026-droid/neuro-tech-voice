// Pure text helpers for extraction, chunking and search. No server-only import
// so they stay unit-testable and dependency-free.

/** Han, kana, Hangul, CJK punctuation and full-width forms: roughly one token per character. */
export function isCjkCode(code: number): boolean {
  return (
    (code >= 0x2e80 && code <= 0x2fff) ||
    (code >= 0x3000 && code <= 0x31ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa960 && code <= 0xa97f) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  )
}

/**
 * Estimated tokens for one UTF-16 code unit in text-embedding-3's tokenizer
 * (cl100k). Latin scripts average about four characters per token; CJK and
 * the Indic, Thai, Lao, Khmer, Myanmar, Georgian and Armenian scripts are close
 * to one per character (Hindi is an agent language); Greek, Cyrillic, Hebrew
 * and Arabic sit around two. Counting those as chars/4 would make chunks up to
 * 4× too large and embedding batches overflow the per-request token cap.
 */
export function tokenCostOf(code: number): number {
  if (isCjkCode(code)) return 1
  if (
    (code >= 0x0530 && code <= 0x058f) ||
    (code >= 0x0900 && code <= 0x0eff) ||
    (code >= 0x1000 && code <= 0x10ff) ||
    (code >= 0x1780 && code <= 0x17ff)
  ) {
    return 1
  }
  if ((code >= 0x0370 && code <= 0x052f) || (code >= 0x0590 && code <= 0x08ff)) return 0.5
  return 0.25
}

/** Token estimate without a tokenizer (see tokenCostOf). */
export function estimateTokens(text: string): number {
  let tokens = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // A low surrogate belongs to the previous character; don't count it twice.
    if (code >= 0xdc00 && code <= 0xdfff) continue
    tokens += tokenCostOf(code)
  }
  return Math.ceil(tokens)
}

/**
 * Cleans text coming out of PDFs, Word files, pages and uploads: BOMs, CRLF,
 * form feeds, control characters, invisible spacing, trailing spaces and runs
 * of blank lines. Unicode is NFC-normalised so "ș" typed two ways matches.
 */
export function normalizeDocumentText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\f\v\u2028\u2029\u0085]/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u00ad\u200b\ufeff]/g, '')
    .replace(/\p{Cc}/gu, (c) => (c === '\n' || c === '\t' ? c : ''))
    .normalize('NFC')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** UTF-8 byte length without allocating an encoded copy. */
export function utf8Length(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

function hardSplitBytes(text: string, maxBytes: number): string[] {
  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  for (const ch of text) {
    const size = utf8Length(ch)
    if (currentBytes + size > maxBytes && current) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += ch
    currentBytes += size
  }
  if (current) parts.push(current)
  return parts
}

function packBySeparators(text: string, maxBytes: number, separators: readonly string[]): string[] {
  const [sep, ...rest] = separators
  if (sep === undefined) return hardSplitBytes(text, maxBytes)
  const sepBytes = utf8Length(sep)
  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  for (const piece of text.split(sep)) {
    const pieceBytes = utf8Length(piece)
    if (pieceBytes > maxBytes) {
      if (current) parts.push(current)
      current = ''
      currentBytes = 0
      parts.push(...packBySeparators(piece, maxBytes, rest))
      continue
    }
    const added = current ? sepBytes + pieceBytes : pieceBytes
    if (current && currentBytes + added > maxBytes) {
      parts.push(current)
      current = piece
      currentBytes = pieceBytes
    } else {
      current = current ? current + sep + piece : piece
      currentBytes += added
    }
  }
  if (current) parts.push(current)
  return parts
}

/**
 * Splits text into parts of at most maxBytes UTF-8 bytes, preferring paragraph,
 * then line, then word boundaries (provider knowledge bases cap document size).
 */
export function splitUtf8Parts(text: string, maxBytes: number): string[] {
  if (!text.trim()) return []
  if (utf8Length(text) <= maxBytes) return [text]
  return packBySeparators(text, maxBytes, ['\n\n', '\n', ' ']).filter((part) => part.trim() !== '')
}

const WESTERN_TERMINATORS = new Set(['.', '!', '?', '…'])
const CJK_TERMINATORS = new Set(['。', '！', '？', '｡'])
const CLOSERS = new Set(['.', '!', '?', '…', '"', "'", '”', '’', ')', ']', '»', '」', '』'])

function isSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\n' || ch === '\t'
}

/**
 * Sentence spans as [start, end) offsets, trimmed of surrounding whitespace.
 * Western terminators only end a sentence before whitespace, so "3.50" and
 * "v2.1" stay whole; CJK terminators end one immediately.
 */
export function splitSentenceRanges(text: string): [number, number][] {
  const ranges: [number, number][] = []
  let start = 0
  const push = (end: number) => {
    let s = start
    let e = end
    while (s < e && isSpace(text[s])) s++
    while (e > s && isSpace(text[e - 1])) e--
    if (e > s) ranges.push([s, e])
    start = end
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n' && text[i + 1] === '\n') {
      push(i)
      continue
    }
    if (CJK_TERMINATORS.has(ch)) {
      let j = i + 1
      while (j < text.length && CLOSERS.has(text[j])) j++
      push(j)
      i = j - 1
      continue
    }
    if (WESTERN_TERMINATORS.has(ch)) {
      let j = i + 1
      while (j < text.length && CLOSERS.has(text[j])) j++
      if (j >= text.length || isSpace(text[j])) {
        push(j)
        i = j - 1
      }
    }
  }
  push(text.length)
  return ranges
}

/** Cuts text to at most maxChars (including the ellipsis), at a word boundary when one is close. */
export function truncateText(text: string, maxChars: number): string {
  const clean = text.trim()
  if (clean.length <= maxChars) return clean
  const limit = Math.max(1, maxChars - 1)
  let cut = clean.slice(0, limit)
  // Already at a word boundary when the next character is whitespace.
  const lastSpace = /\s/.test(clean[limit]) ? -1 : cut.search(/\s\S*$/)
  if (lastSpace > limit * 0.6) cut = cut.slice(0, lastSpace)
  return `${cut.replace(/[\s,;:.–—-]+$/, '')}…`
}
