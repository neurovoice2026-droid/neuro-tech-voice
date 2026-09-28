import { estimateTokens, splitSentenceRanges, tokenCostOf } from './text'

// Heading-aware chunker for the knowledge base. Text is split into sections at
// headings (Markdown, setext, and the plain-text shapes PDFs and Word files
// produce), each section is packed into ~500-token chunks at paragraph, line,
// sentence and word boundaries, and consecutive chunks of a section share ~15 %
// overlap so an answer that straddles a boundary is still found whole. The
// heading trail ("Prices › Colour") is kept on each chunk: it goes into the
// embedding input and is shown as the source of an answer.

export const DEFAULT_CHUNK_TOKENS = 500
export const DEFAULT_OVERLAP_RATIO = 0.15
/** Bump when chunking changes in a way that should re-embed unchanged documents. */
export const CHUNKER_VERSION = 2

const MAX_HEADING_LENGTH = 120
const MAX_TRAIL_LENGTH = 200
const TRAIL_SEPARATOR = ' › '

export interface TextChunk {
  index: number
  /** Heading trail of the section, e.g. "Prices › Colour"; null before the first heading. */
  heading: string | null
  content: string
  token_count: number
}

export interface ChunkOptions {
  /** Target size per chunk (estimated tokens). */
  targetTokens?: number
  /** Share of the target repeated at the start of the next chunk in a section. */
  overlapRatio?: number
}

interface Section {
  heading: string | null
  blocks: string[]
}

interface Unit {
  text: string
  /** Joins this unit to the previous one inside a chunk. */
  sep: string
  tokens: number
}

interface PackedChunk {
  units: Unit[]
  /** Units before this index were carried over from the previous chunk. */
  freshFrom: number
}

const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const LIST_ITEM = /^\s*(?:[-*+•▪◦]|\d+[.)]|[a-z][.)])\s+/i
const NUMBERED_SECTION = /^(\d+(?:\.\d+)+)\.?\s+\S/

function cleanHeading(text: string): string {
  const clean = text
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[\s:]+$/, '')
    .trim()
  return clean.length > MAX_HEADING_LENGTH ? `${clean.slice(0, MAX_HEADING_LENGTH - 1)}…` : clean
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Plain-text heading shapes, only for a line that starts a block: "2.1 Refunds",
 * "OPENING HOURS", "Prices:". Lines with digits (other than section numbers)
 * are content: hours, prices and phone numbers must never become headings.
 */
function plainHeadingLevel(line: string): number | null {
  if (line.length < 3 || line.length > 80) return null
  if (!/\p{L}/u.test(line) || line.includes('|')) return null

  const numbered = NUMBERED_SECTION.exec(line)
  if (numbered) {
    if (/[.;,!?]$/.test(line) || wordCount(line) > 10) return null
    return Math.min(6, 1 + numbered[1].split('.').length)
  }
  if (LIST_ITEM.test(line) || /\d/.test(line) || /[.;,!?]$/.test(line)) return null

  const hasCase = line.toUpperCase() !== line.toLowerCase()
  const letters = line.replace(/[^\p{L}]/gu, '')
  if (hasCase && letters.length >= 3 && line === line.toUpperCase() && wordCount(line) <= 10) return 2
  if (line.endsWith(':') && wordCount(line) <= 8) return 3
  return null
}

function parseSections(text: string): Section[] {
  const lines = text.split('\n')
  const sections: Section[] = []
  const stack: { level: number; text: string; plain: boolean }[] = []
  let current: Section = { heading: null, blocks: [] }
  let block: string[] = []

  const flushBlock = () => {
    const joined = block.join('\n').trim()
    if (joined) current.blocks.push(joined)
    block = []
  }
  const trail = () => {
    const joined = stack.slice(-3).map((h) => h.text).join(TRAIL_SEPARATOR)
    return joined.length > MAX_TRAIL_LENGTH ? `${joined.slice(0, MAX_TRAIL_LENGTH - 1)}…` : joined
  }
  const startSection = (level: number, headingText: string, plain: boolean) => {
    flushBlock()
    if (current.blocks.length > 0) sections.push(current)
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
    if (headingText) stack.push({ level, text: headingText, plain })
    current = { heading: stack.length > 0 ? trail() : null, blocks: [] }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || THEMATIC_BREAK.test(line)) {
      flushBlock()
      continue
    }

    const atx = ATX_HEADING.exec(line)
    if (atx) {
      startSection(atx[1].length, cleanHeading(atx[2]), false)
      continue
    }

    if (block.length === 0) {
      const next = lines[i + 1]
      if (
        next !== undefined &&
        SETEXT_UNDERLINE.test(next) &&
        trimmed.length <= MAX_HEADING_LENGTH &&
        !LIST_ITEM.test(trimmed) &&
        !trimmed.includes('|')
      ) {
        startSection(next.trim().startsWith('=') ? 1 : 2, cleanHeading(trimmed), false)
        i++
        continue
      }
      const plainLevel = plainHeadingLevel(trimmed)
      if (plainLevel !== null) {
        startSection(plainLevel, cleanHeading(trimmed), true)
        continue
      }
    }
    block.push(line)
  }
  flushBlock()
  if (current.blocks.length > 0) {
    sections.push(current)
  } else if (stack.length > 0 && stack[stack.length - 1].plain) {
    // A heading-shaped last line with nothing under it was probably content
    // ("THANK YOU FOR CHOOSING US"): keep its words.
    const last = stack.pop() as { text: string }
    sections.push({ heading: stack.length > 0 ? trail() : null, blocks: [last.text] })
  }

  if (sections.length === 0 && text.trim()) {
    sections.push({ heading: null, blocks: [text.trim()] })
  }
  return sections
}

// ─── Units ───────────────────────────────────────────────────────────────────

function unit(text: string, sep: string): Unit {
  return { text, sep, tokens: estimateTokens(text) }
}

/** Last resort for text without usable spaces (long CJK runs, URLs): cut by estimated tokens. */
function hardSplit(text: string, target: number, sep: string): Unit[] {
  const units: Unit[] = []
  let current = ''
  let tokens = 0
  for (const ch of text) {
    const cost = tokenCostOf(ch.charCodeAt(0))
    if (tokens + cost > target && current) {
      units.push(unit(current, units.length === 0 ? sep : ''))
      current = ''
      tokens = 0
    }
    current += ch
    tokens += cost
  }
  if (current) units.push(unit(current, units.length === 0 ? sep : ''))
  return units
}

function splitWords(text: string, target: number, sep: string): Unit[] {
  if (estimateTokens(text) <= target) return [unit(text, sep)]
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return hardSplit(text, target, sep)

  const units: Unit[] = []
  let current: string[] = []
  let tokens = 0
  const flush = () => {
    if (current.length === 0) return
    units.push(unit(current.join(' '), units.length === 0 ? sep : ' '))
    current = []
    tokens = 0
  }
  for (const word of words) {
    const cost = estimateTokens(word) + (current.length > 0 ? 0.25 : 0)
    if (estimateTokens(word) > target) {
      flush()
      for (const piece of hardSplit(word, target, units.length === 0 ? sep : ' ')) units.push(piece)
      continue
    }
    if (tokens + cost > target) flush()
    current.push(word)
    tokens += cost
  }
  flush()
  return units
}

function splitSentences(text: string, target: number, sep: string): Unit[] {
  if (estimateTokens(text) <= target) return [unit(text, sep)]
  const ranges = splitSentenceRanges(text)
  if (ranges.length <= 1) return splitWords(text, target, sep)
  const units: Unit[] = []
  ranges.forEach(([start, end], i) => {
    // CJK sentences follow each other without a space; keep it that way.
    const gap = i === 0 ? sep : start > ranges[i - 1][1] ? ' ' : ''
    units.push(...splitWords(text.slice(start, end), target, gap))
  })
  return units
}

function blockUnits(block: string, target: number): Unit[] {
  if (estimateTokens(block) <= target) return [unit(block, '\n\n')]
  // Lists, tables and addresses break by line first, then by sentence.
  const lines = block.split('\n').filter((line) => line.trim() !== '')
  if (lines.length > 1) {
    return lines.flatMap((line, i) => splitSentences(line, target, i === 0 ? '\n\n' : '\n'))
  }
  return splitSentences(block, target, '\n\n')
}

// ─── Packing ─────────────────────────────────────────────────────────────────

function tailOfText(text: string, budget: number): string {
  const maxChars = Math.max(1, Math.floor(budget * 4))
  if (estimateTokens(text) <= budget) return text
  let tail = ''
  let tokens = 0
  const chars = Array.from(text)
  for (let i = chars.length - 1; i >= 0; i--) {
    const cost = tokenCostOf(chars[i].charCodeAt(0))
    if (tokens + cost > budget || tail.length >= maxChars) break
    tail = chars[i] + tail
    tokens += cost
  }
  // Start at a word boundary when the tail begins mid-word.
  const firstSpace = tail.search(/\s/)
  if (firstSpace > 0 && firstSpace < tail.length / 2) tail = tail.slice(firstSpace + 1)
  return tail.trim()
}

function overlapTail(units: Unit[], budget: number): Unit[] {
  if (budget <= 0 || units.length === 0) return []
  const tail: Unit[] = []
  let tokens = 0
  for (let i = units.length - 1; i >= 0; i--) {
    if (tokens + units[i].tokens > budget) break
    tail.unshift(units[i])
    tokens += units[i].tokens
  }
  if (tail.length > 0) return tail
  const text = tailOfText(units[units.length - 1].text, budget)
  return text ? [unit(text, '')] : []
}

function joinUnits(units: Unit[]): string {
  return units.map((u, i) => (i === 0 ? u.text : u.sep + u.text)).join('').trim()
}

function sumTokens(units: Unit[]): number {
  return units.reduce((total, u) => total + u.tokens, 0)
}

function packSection(section: Section, target: number, overlap: number): string[] {
  const units = section.blocks.flatMap((b) => blockUnits(b, target))
  const chunks: PackedChunk[] = []
  let current: Unit[] = []
  let freshFrom = 0
  let tokens = 0

  for (const next of units) {
    if (current.length > freshFrom && tokens + next.tokens > target) {
      chunks.push({ units: current, freshFrom })
      current = overlapTail(current, overlap)
      freshFrom = current.length
      tokens = sumTokens(current)
    }
    current.push(next)
    tokens += next.tokens
  }
  if (current.length > freshFrom) chunks.push({ units: current, freshFrom })

  // A small remainder reads better as the end of the previous chunk.
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1]
    const prev = chunks[chunks.length - 2]
    const fresh = last.units.slice(last.freshFrom)
    if (sumTokens(fresh) < target * 0.25 && sumTokens(prev.units) + sumTokens(fresh) <= target * 1.25) {
      prev.units = [...prev.units, ...fresh]
      chunks.pop()
    }
  }
  return chunks.map((c) => joinUnits(c.units)).filter(Boolean)
}

export function chunkDocument(text: string, opts: ChunkOptions = {}): TextChunk[] {
  const target = Math.min(2000, Math.max(50, Math.round(opts.targetTokens ?? DEFAULT_CHUNK_TOKENS)))
  const ratio = Math.min(0.5, Math.max(0, opts.overlapRatio ?? DEFAULT_OVERLAP_RATIO))
  const overlap = Math.floor(target * ratio)

  const chunks: TextChunk[] = []
  for (const section of parseSections(text)) {
    for (const content of packSection(section, target, overlap)) {
      chunks.push({ index: chunks.length, heading: section.heading, content, token_count: estimateTokens(content) })
    }
  }
  return chunks
}

/** What gets embedded: the document name and heading give a bare passage its context. */
export function embeddingInputFor(chunk: Pick<TextChunk, 'heading' | 'content'>, documentName: string): string {
  const header = [documentName.trim(), chunk.heading?.trim() ?? ''].filter(Boolean).join('\n')
  return header ? `${header}\n\n${chunk.content}` : chunk.content
}
