// Splits streamed LLM text into speakable pieces for TTS.
//
// Cartesia concatenates continuation transcripts verbatim and sounds best when
// each piece ends a sentence, so we buffer deltas until a real sentence
// boundary and emit the text *including* its trailing whitespace. Things that
// look like boundaries but aren't stay intact: decimals (3.5, 12,50), times
// (10:30), abbreviations (Dr., e.g., etc., nr.), initials (J. Smith),
// ellipses inside a sentence, and numbered list markers. A run-on sentence is
// split at a clause boundary once it gets long, so latency stays bounded; the
// first piece after a flush splits sooner, because it decides when the caller
// hears anything at all (Cartesia keeps prosody across pieces of one context).

const SENTENCE_END = /[.!?…]/
const CJK_END = /[。！？؟।]/
const CLAUSE_END = /[,;:，、；：]/
const CLOSERS = /["'”’»)\]]/

// Lower-case, without the trailing dot. Only forms that practically never end
// a sentence: "no.", "sun." or "art." do, so they aren't here.
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'approx', 'nr', 'tel', 'dept', 'inc',
  'ltd', 'corp', 'jan', 'feb', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'tue', 'thu', 'fri',
  'a.m', 'p.m', 'str', 'bd', 'bdul', 'șos', 'ap', 'sc', 'et', 'jud', 'dl', 'dna', 'dvs', 'pt', 'alin', 'sra', 'sres',
  'ud', 'uds', 'av', 'mme', 'mlle', 'bzw', 'usw', 'z.b', 'd.h', 'sig', 'dott', 'ing', 'avv', 'sig.ra', 'dra', 'ul',
  'np', 'tj', 'dhr', 'mevr', 'bijv',
])

/** A later run-on sentence is split at a clause once it is this long. */
const LONG_SENTENCE_CHARS = 160
/** The first piece (nothing emitted since the last flush) splits at a clause from this length. */
const FIRST_PIECE_CLAUSE_CHARS = 50

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

function wordBefore(text: string, index: number): string {
  let start = index
  while (start > 0 && /[\p{L}\p{N}.]/u.test(text[start - 1])) start--
  return text.slice(start, index)
}

/** Index just past a boundary ending at `i` (closing quotes/brackets included), or -1. */
function boundaryEnd(text: string, i: number, final: boolean): number {
  const ch = text[i]
  let end = i + 1
  while (end < text.length && CLOSERS.test(text[end])) end++

  if (CJK_END.test(ch)) return end

  if (!SENTENCE_END.test(ch)) return -1
  // Collapse runs like "?!" or "..." into one boundary at the last mark.
  if (end < text.length && SENTENCE_END.test(text[end])) return -1

  const next = text[end]
  if (next === undefined) return final ? end : -1 // need to see what follows
  if (!/\s/.test(next)) return -1 // "3.5", "e.g.x", "example.com"

  if (ch === '.') {
    const prev = text[i - 1]
    // "1. " at the start of a list item, "3. " ordinals, "10. oktober".
    if (isDigit(prev)) {
      const before = wordBefore(text, i)
      if (/^\d{1,3}$/.test(before)) {
        const after = text.slice(end).trimStart()[0]
        // A digit followed by a lower-case word is an ordinal/list marker, not an end.
        if (after === undefined || (after.toLowerCase() === after && after.toUpperCase() !== after)) return -1
      }
    }
    const word = wordBefore(text, i).toLowerCase()
    if (ABBREVIATIONS.has(word)) return -1
    // Single-letter initials: "J. Smith".
    if (/^\p{L}$/u.test(word) && /\p{Lu}/u.test(wordBefore(text, i))) return -1
  }
  // Include the whitespace run so concatenation stays verbatim.
  while (end < text.length && /\s/.test(text[end])) end++
  return end
}

export class SentenceChunker {
  private buffer = ''
  /** Something was emitted since the last flush/reset. */
  private emitted = false

  /** Adds a delta; returns zero or more complete pieces ready for TTS. */
  push(delta: string): string[] {
    if (!delta) return []
    this.buffer += delta
    return this.extract(false)
  }

  /** Everything still buffered (end of the model output). */
  flush(): string[] {
    const pieces = this.extract(true)
    if (this.buffer.trim()) pieces.push(this.buffer)
    this.buffer = ''
    this.emitted = false
    return pieces
  }

  get pending(): string {
    return this.buffer
  }

  reset(): void {
    this.buffer = ''
    this.emitted = false
  }

  private extract(final: boolean): string[] {
    const pieces: string[] = []
    let start = 0
    for (let i = 0; i < this.buffer.length; i++) {
      const end = boundaryEnd(this.buffer, i, final)
      if (end !== -1) {
        pieces.push(this.buffer.slice(start, end))
        start = end
        i = end - 1
        continue
      }
      // Run-on sentence: split after a clause mark followed by a space ("12, 50" stays whole).
      const splitAt = this.emitted || pieces.length > 0 ? LONG_SENTENCE_CHARS : FIRST_PIECE_CLAUSE_CHARS
      if (
        i - start >= splitAt &&
        CLAUSE_END.test(this.buffer[i]) &&
        /\s/.test(this.buffer[i + 1] ?? '') &&
        // "12, 50": after a digit, wait to see whether a number follows.
        !(isDigit(this.buffer[i - 1]) && (this.buffer[i + 2] === undefined ? !final : isDigit(this.buffer[i + 2])))
      ) {
        let end = i + 1
        while (end < this.buffer.length && /\s/.test(this.buffer[end])) end++
        pieces.push(this.buffer.slice(start, end))
        start = end
        i = end - 1
      }
    }
    this.buffer = this.buffer.slice(start)
    const out = pieces.filter((p) => p.length > 0)
    if (out.length > 0) this.emitted = true
    return out
  }
}
