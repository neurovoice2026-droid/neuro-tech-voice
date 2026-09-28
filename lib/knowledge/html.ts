// HTML → readable text for knowledge-base web pages (and Word files, which
// mammoth converts to HTML). No DOM or new dependency: a tolerant tag scanner
// drops page chrome (scripts, navigation, footers, asides, hidden elements),
// prefers <main>/<article> when they hold the content, and keeps structure as
// plain text: "## Heading" lines the chunker understands, "- " list items and
// "cell | cell" table rows.

export interface HtmlText {
  title: string | null
  text: string
}

const RAW_TEXT_NAMES = 'script|style|noscript|template|textarea|xmp'
const CHROME_ELEMENTS = new Set([
  'head', 'title', 'nav', 'footer', 'aside', 'svg', 'math', 'iframe', 'object', 'canvas', 'video', 'audio',
  'map', 'select', 'button', 'dialog', 'picture',
])
const CHROME_ROLES = /(?:^|\s)role\s*=\s*["']?(navigation|banner|contentinfo|complementary|search|dialog|alertdialog|menu|menubar)\b/i

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'caption', 'center', 'details', 'dialog', 'dir', 'div',
  'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'header', 'hgroup', 'html', 'legend', 'main',
  'menu', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'tfoot', 'thead', 'ul',
])

// Private-use markers that can't occur in decoded page text.
const CELL = '\ue000'
const PRE_NEWLINE = '\ue001'

// ─── Entities ────────────────────────────────────────────────────────────────

const LATIN1_NAMES = (
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 ' +
  'acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde ' +
  'Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc ' +
  'Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml ' +
  'aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc ' +
  'otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ')

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  hellip: '…', bull: '•', euro: '€', trade: '™', dagger: '†', Dagger: '‡', permil: '‰', lsaquo: '‹',
  rsaquo: '›', OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ', fnof: 'ƒ', circ: 'ˆ',
  tilde: '˜', ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '', zwj: '\u200d', lrm: '', rlm: '',
  prime: '′', Prime: '″', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', minus: '−',
  le: '≤', ge: '≥', ne: '≠', asymp: '≈', infin: '∞', check: '✓', star: '☆', starf: '★',
  Abreve: 'Ă', abreve: 'ă', Scedil: 'Ş', scedil: 'ş', Tcedil: 'Ţ', tcedil: 'ţ',
  Zcaron: 'Ž', zcaron: 'ž', Ccaron: 'Č', ccaron: 'č', Lstrok: 'Ł', lstrok: 'ł', nbsp: ' ',
}
LATIN1_NAMES.forEach((name, i) => {
  NAMED_ENTITIES[name] ??= String.fromCharCode(160 + i)
})
NAMED_ENTITIES.nbsp = ' '
NAMED_ENTITIES.shy = ''

// Old pages send Windows-1252 code points as numeric references (&#150;).
const CP1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x89: '‰', 0x8b: '‹', 0x8c: 'Œ',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™', 0x9b: '›', 0x9c: 'œ',
}

// Browsers also accept these few without the semicolon.
const LEGACY_NO_SEMICOLON = new Set(['amp', 'lt', 'gt', 'quot', 'nbsp'])

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31})(;?)/gi, (match, body: string, semi: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (CP1252[code]) return CP1252[code]
      if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd'
      return String.fromCodePoint(code)
    }
    const value = NAMED_ENTITIES[body]
    if (value === undefined) return match
    if (!semi && !LEGACY_NO_SEMICOLON.has(body)) return match
    return value
  })
}

// ─── Element scanning ────────────────────────────────────────────────────────

/** The hidden attribute (not a "hidden" CSS class), aria-hidden, or an inline display:none. */
function isHiddenElement(attrs: string): boolean {
  const withoutValues = attrs.replace(/"[^"]*"|'[^']*'/g, '""')
  if (/(?:^|\s)hidden(?:[\s=/]|$)/i.test(withoutValues)) return true
  if (/(?:^|\s)aria-hidden\s*=\s*["']?true/i.test(attrs)) return true
  return /(?:^|\s)style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs)
}

const OPEN_TAG = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g

// Malformed pages (thousands of unclosed tags) must not make these scans
// quadratic: a page is up to 5 MB and the whole ingest shares one function run.
// Closing tags are matched per element name in a single pass, and a search that
// found no closing tag is never repeated for a later opener.

/**
 * For one element name: offset just past each opening tag → offset just past
 * the tag that closes it (nesting counted). Unclosed openers are absent.
 */
function closingTagEnds(html: string, name: string): Map<number, number> {
  const ends = new Map<number, number>()
  const open: number[] = []
  const scanner = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = scanner.exec(html))) {
    if (!match[1]) {
      if (!match[0].endsWith('/>')) open.push(scanner.lastIndex)
    } else {
      const opener = open.pop()
      if (opener !== undefined) ends.set(opener, scanner.lastIndex)
    }
  }
  return ends
}

/** Closing-tag lookup for one HTML string (offset just past the opening tag → past its closing tag, or -1). */
function closingTagIndex(html: string): (name: string, from: number) => number {
  const byName = new Map<string, Map<number, number>>()
  return (name, from) => {
    let ends = byName.get(name)
    if (!ends) {
      ends = closingTagEnds(html, name)
      byName.set(name, ends)
    }
    return ends.get(from) ?? -1
  }
}

/**
 * Rewrites every closed element of the given names (`<td>…</td>`: the first
 * closing tag of the same name ends it) left to right. Unclosed openers stay.
 */
function replaceClosedElements(
  html: string,
  names: string,
  replace: (tag: string, attrs: string, inner: string) => string
): string {
  const opener = new RegExp(`<(${names})\\b([^>]*)>`, 'gi')
  const closers = new Map<string, RegExp>()
  const unclosed = new Set<string>()
  let out = ''
  let last = 0
  let match: RegExpExecArray | null
  while ((match = opener.exec(html))) {
    const tag = match[1]
    const key = tag.toLowerCase()
    if (unclosed.has(key)) continue
    let closer = closers.get(key)
    if (!closer) {
      closer = new RegExp(`</${key}\\s*>`, 'gi')
      closers.set(key, closer)
    }
    closer.lastIndex = opener.lastIndex
    const close = closer.exec(html)
    if (!close) {
      // No closing tag after this opener, so none after any later one either.
      unclosed.add(key)
      continue
    }
    out += html.slice(last, match.index) + replace(tag, match[2], html.slice(opener.lastIndex, close.index))
    last = closer.lastIndex
    opener.lastIndex = closer.lastIndex
  }
  return out + html.slice(last)
}

/** Drops comments, CDATA and raw-text elements (scripts, styles…) in document order; unclosed ones are left to the tag cleanup. */
function removeRawBlocks(html: string): string {
  const opener = new RegExp(`<!--|<!\\[CDATA\\[|<(${RAW_TEXT_NAMES})\\b[^>]*>`, 'gi')
  const closers = new Map<string, RegExp>()
  const unclosed = new Set<string>()
  let out = ''
  let last = 0
  let match: RegExpExecArray | null
  while ((match = opener.exec(html))) {
    const kind = match[1] ? match[1].toLowerCase() : match[0].startsWith('<!--') ? '-->' : ']]>'
    if (unclosed.has(kind)) continue
    let end = -1
    if (!match[1]) {
      const at = html.indexOf(kind, opener.lastIndex)
      if (at !== -1) end = at + kind.length
    } else {
      let closer = closers.get(kind)
      if (!closer) {
        closer = new RegExp(`</${kind}\\s*>`, 'gi')
        closers.set(kind, closer)
      }
      closer.lastIndex = opener.lastIndex
      if (closer.exec(html)) end = closer.lastIndex
    }
    if (end === -1) {
      unclosed.add(kind)
      continue
    }
    out += `${html.slice(last, match.index)} `
    last = end
    opener.lastIndex = end
  }
  return out + html.slice(last)
}

function removeElements(html: string, shouldRemove: (name: string, attrs: string) => boolean): string {
  const findClosingEnd = closingTagIndex(html)
  let out = ''
  let last = 0
  const scanner = new RegExp(OPEN_TAG.source, 'g')
  let match: RegExpExecArray | null
  while ((match = scanner.exec(html))) {
    const name = match[1].toLowerCase()
    const attrs = match[2]
    if (!shouldRemove(name, attrs)) continue
    if (VOID_ELEMENTS.has(name) || attrs.trim().endsWith('/')) {
      out += html.slice(last, match.index)
      last = scanner.lastIndex
      continue
    }
    const end = findClosingEnd(name, scanner.lastIndex)
    // Unclosed element (sloppy markup): drop only the tag rather than the rest of the page.
    const removeUntil = end === -1 ? scanner.lastIndex : end
    out += `${html.slice(last, match.index)} `
    last = removeUntil
    scanner.lastIndex = removeUntil
  }
  return out + html.slice(last)
}

/** Inner HTML of the first element with this tag name, or null. */
function innerOf(html: string, name: string): string | null {
  const open = new RegExp(`<${name}\\b[^>]*>`, 'i').exec(html)
  if (!open) return null
  const start = open.index + open[0].length
  const end = closingTagIndex(html)(name, start)
  if (end === -1) return html.slice(start)
  const closeStart = html.lastIndexOf('<', end - 1)
  return html.slice(start, closeStart)
}

function countOpenTags(html: string, name: string): number {
  return (html.match(new RegExp(`<${name}\\b`, 'gi')) ?? []).length
}

// ─── Conversion ──────────────────────────────────────────────────────────────

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Titles live in <head>; looking further only costs time on huge pages.
const TITLE_SEARCH_CHARS = 256 * 1024
const MAX_META_TAG_CHARS = 4096

/** Text of the first <title>, found with plain index scans (no regex backtracking over the page). */
function titleElementText(html: string, lower: string): string | null {
  let from = 0
  for (;;) {
    const open = lower.indexOf('<title', from)
    if (open === -1) return null
    const after = lower.charAt(open + 6)
    const openEnd = lower.indexOf('>', open)
    if (openEnd === -1) return null
    if (after === '>' || /\s|\//.test(after)) {
      const close = lower.indexOf('</title', openEnd)
      return close === -1 ? null : html.slice(openEnd + 1, close)
    }
    from = open + 6
  }
}

/** content of <meta property="og:title">, reading each meta tag on its own. */
function ogTitle(html: string, lower: string): string | null {
  let from = 0
  for (;;) {
    const open = lower.indexOf('<meta', from)
    if (open === -1) return null
    const end = lower.indexOf('>', open)
    if (end === -1) return null
    from = end + 1
    if (end - open > MAX_META_TAG_CHARS) continue
    const tag = html.slice(open, end + 1)
    if (!/property\s*=\s*["']og:title["']/i.test(tag)) continue
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag)
    if (content) return content[1] ?? content[2] ?? null
  }
}

export function extractHtmlTitle(html: string): string | null {
  const head = html.slice(0, TITLE_SEARCH_CHARS)
  const lower = head.toLowerCase()
  const title = titleElementText(head, lower)
  const og = ogTitle(head, lower)
  for (const candidate of [title, og]) {
    if (!candidate) continue
    const clean = collapseSpaces(decodeHtmlEntities(candidate.replace(/<[^>]*>/g, ' ')))
    if (clean) return clean.length > 200 ? `${clean.slice(0, 199)}…` : clean
  }
  return null
}

function markupToText(html: string): string {
  // Keep line breaks inside <pre> (opening hours, menus laid out with spaces).
  let body = replaceClosedElements(html, 'pre', (_tag, _attrs, inner) =>
    `<pre>${inner.replace(/\r?\n/g, PRE_NEWLINE)}</pre>`
  )
  // A table row stays on one line: paragraphs and breaks inside a cell (Word
  // tables always wrap cell text in <p>) become spaces.
  body = replaceClosedElements(body, 'td|th', (tag, attrs, inner) =>
    `<${tag}${attrs}>${inner.replace(/<\/?(?:p|div|br|ul|ol|li|h[1-6]|section|article|blockquote)\b[^>]*>/gi, ' ')}</${tag}>`
  )
  body = body.replace(/\s+/g, ' ')

  body = body.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g, (_m, closing: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase()
    const heading = /^h([1-6])$/.exec(name)
    if (heading) return closing ? '\n\n' : `\n\n${'#'.repeat(Number(heading[1]))} `
    switch (name) {
      case 'br':
        return '\n'
      case 'hr':
        return '\n\n'
      case 'li':
        return closing ? '\n' : '\n- '
      case 'tr':
        return closing ? '' : '\n'
      case 'td':
      case 'th':
        return closing ? ' ' : CELL
      case 'dt':
      case 'dd':
        return '\n'
      case 'img': {
        // Alt text sometimes carries real content (a price list saved as an image has none).
        const alt = /\balt\s*=\s*["']([^"']{4,200})["']/i.exec(attrs)?.[1]
        return alt ? ` ${alt} ` : ' '
      }
      default:
        return BLOCK_ELEMENTS.has(name) ? '\n\n' : ''
    }
  })
  // Anything left that still looks like markup (unterminated tags, stray comments).
  body = body.replace(/<[^>]*>/g, '')

  const lines = decodeHtmlEntities(body)
    .replaceAll(PRE_NEWLINE, '\n')
    .split('\n')
    .map((line) => {
      if (line.includes(CELL)) {
        return line
          .split(CELL)
          .map((cell) => collapseSpaces(cell))
          .filter(Boolean)
          .join(' | ')
      }
      return line.replace(/[ \t\u00a0]+/g, ' ').trim()
    })
    .filter((line) => !/^(?:[-•]|#{1,6})$/.test(line))

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function visibleTextLength(html: string): number {
  return collapseSpaces(decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))).length
}

/**
 * A "<" with no ">" anywhere after it can't start a tag, but every `<…[^>]*>`
 * pattern would rescan to the end of the page from each one. Escape them once.
 */
function escapeUnterminatedTail(html: string): string {
  const lastGt = html.lastIndexOf('>')
  const tail = html.slice(lastGt + 1)
  return tail.includes('<') ? html.slice(0, lastGt + 1) + tail.replaceAll('<', '&lt;') : html
}

export function htmlToText(html: string): HtmlText {
  const title = extractHtmlTitle(html)

  let doc = removeRawBlocks(escapeUnterminatedTail(html)).replace(/<![^>]*>|<\?[^>]*>/g, ' ')

  doc = removeElements(doc, (name, attrs) =>
    CHROME_ELEMENTS.has(name) || CHROME_ROLES.test(attrs) || isHiddenElement(attrs)
  )

  // Prefer the page's main content when it clearly holds it.
  const bodyHtml = innerOf(doc, 'body') ?? doc
  const bodyLength = visibleTextLength(bodyHtml)
  let content = bodyHtml
  const main = innerOf(bodyHtml, 'main')
  if (main !== null && visibleTextLength(main) >= Math.min(200, bodyLength * 0.5)) {
    content = main
  } else if (countOpenTags(bodyHtml, 'article') === 1) {
    const article = innerOf(bodyHtml, 'article')
    if (article !== null && visibleTextLength(article) >= Math.min(200, bodyLength * 0.5)) content = article
  }

  return { title, text: markupToText(content) }
}
