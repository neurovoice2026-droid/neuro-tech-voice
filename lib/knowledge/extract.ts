import 'server-only'
import { KnowledgeIngestError } from './errors'
import { htmlToText } from './html'
import { KNOWLEDGE_MAX_CHARACTERS, KNOWLEDGE_MAX_TOKENS, type KnowledgeFileType } from './shared'
import { estimateTokens, normalizeDocumentText } from './text'

// Text extraction for knowledge documents. PDF (unpdf, serverless PDF.js) and
// Word (mammoth) are loaded lazily so only the ingest path pays for them. Every
// failure the owner can fix becomes a KnowledgeIngestError with a plain message.

export type ExtractableKind = KnowledgeFileType | 'html'

export interface ExtractedDocument {
  /** Normalised text (LF line endings, no BOM or control characters). */
  text: string
  /** <title> for web pages; null otherwise. */
  title: string | null
  pages: number | null
}

const SNIFF_BYTES = 8192
// Fewer readable characters than this per page means the PDF is mostly images.
const MIN_CHARS_PER_PAGE = 15

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, i) => bytes[offset + i] === byte)
}

function indexOfAscii(bytes: Uint8Array, needle: string, limit: number): number {
  const end = Math.min(bytes.length, limit) - needle.length
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) continue outer
    }
    return i
  }
  return -1
}

function utf16Bom(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  if (startsWith(bytes, [0xff, 0xfe])) return 'utf-16le'
  if (startsWith(bytes, [0xfe, 0xff])) return 'utf-16be'
  return null
}

function looksBinary(bytes: Uint8Array): boolean {
  if (utf16Bom(bytes)) return false
  const end = Math.min(bytes.length, SNIFF_BYTES)
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) return true
  }
  return false
}

/** Checks the file really is what its extension says (magic bytes), before any parser sees it. */
export function hasExpectedSignature(kind: ExtractableKind, bytes: Uint8Array): boolean {
  switch (kind) {
    case 'pdf':
      // Some generators put a few bytes of junk before the header; readers allow 1 KB.
      return indexOfAscii(bytes, '%PDF-', 1024) !== -1
    case 'docx':
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
    default:
      return !looksBinary(bytes)
  }
}

function decodeWith(label: string, bytes: Uint8Array, fatal: boolean): string | null {
  try {
    return new TextDecoder(label, { fatal }).decode(bytes)
  } catch {
    return null
  }
}

/**
 * Bytes → string: BOM first, then the declared charset, then strict UTF-8,
 * then Windows-1252 (what most old "ANSI" text files really are).
 */
export function decodeTextBytes(bytes: Uint8Array, charset?: string | null): string {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) return decodeWith('utf-8', bytes.subarray(3), false) ?? ''
  const bom = utf16Bom(bytes)
  if (bom) return decodeWith(bom, bytes.subarray(2), false) ?? ''

  const declared = charset?.trim().toLowerCase()
  if (declared && declared !== 'utf-8' && declared !== 'utf8') {
    const decoded = decodeWith(declared, bytes, false)
    if (decoded !== null) return decoded
  }
  return decodeWith('utf-8', bytes, true) ?? decodeWith('windows-1252', bytes, false) ?? decodeWith('utf-8', bytes, false) ?? ''
}

/** <meta charset> or <meta http-equiv="Content-Type" content="…; charset=…"> in the first bytes of a page. */
export function sniffHtmlCharset(bytes: Uint8Array): string | null {
  const head = decodeWith('latin1', bytes.subarray(0, 4096), false) ?? ''
  return /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_:.-]+)/i.exec(head)?.[1] ?? null
}

function errorName(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string'
    ? (error as { name: string }).name
    : ''
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null
  try {
    // PDF.js may transfer the buffer to its worker; give it a copy.
    pdf = await getDocumentProxy(new Uint8Array(bytes))
    const { totalPages, text } = await extractText(pdf, { mergePages: true })
    return { text, pages: totalPages }
  } catch (error) {
    if (errorName(error) === 'PasswordException') {
      throw new KnowledgeIngestError(
        'pdf_password',
        'This PDF is password-protected. Remove the password (or print it to a new PDF) and upload it again.',
        { cause: error }
      )
    }
    throw new KnowledgeIngestError(
      'pdf_unreadable',
      'We couldn’t open this PDF. It may be damaged. Try exporting it again from the app that created it.',
      { cause: error }
    )
  } finally {
    await pdf?.loadingTask.destroy().catch(() => undefined)
  }
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    // HTML keeps headings, lists and tables; images are skipped rather than inlined as base64.
    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) }
    )
    const { text } = htmlToText(html)
    if (text.trim()) return text
    const { value: raw } = await mammoth.extractRawText({ buffer })
    return raw
  } catch (error) {
    throw new KnowledgeIngestError(
      'docx_unreadable',
      'We couldn’t open this Word document. It may be damaged or password-protected. Open it in Word, save it again as .docx and upload it again.',
      { cause: error }
    )
  }
}

const WRONG_TYPE_MESSAGES: Record<ExtractableKind, string> = {
  pdf: 'This file isn’t a real PDF, even though its name ends in .pdf. Export it as a PDF again and upload that.',
  docx: 'This file isn’t a real Word (.docx) document. Open it in Word, save it as .docx and upload it again.',
  txt: 'This file doesn’t contain plain text. If it’s a PDF or Word document, upload it with the right file extension.',
  md: 'This file doesn’t contain plain text. If it’s a PDF or Word document, upload it with the right file extension.',
  html: 'This page didn’t send readable text.',
}

const EMPTY_MESSAGES: Record<ExtractableKind, string> = {
  pdf: 'This PDF has no text we can read. It looks like a scanned image. Upload a PDF with selectable text, or copy the text into a Word or .txt file.',
  docx: 'This Word document has no text in it.',
  txt: 'This file is empty.',
  md: 'This file is empty.',
  html: 'We couldn’t find readable text on this page. It may load its content with JavaScript. Try another page, or copy the text into a .txt file and upload it.',
}

export async function extractDocumentText(input: {
  kind: ExtractableKind
  bytes: Uint8Array
  /** Declared charset for text and HTML (Content-Type header). */
  charset?: string | null
}): Promise<ExtractedDocument> {
  const { kind, bytes } = input
  if (!hasExpectedSignature(kind, bytes)) {
    throw new KnowledgeIngestError('wrong_file_type', WRONG_TYPE_MESSAGES[kind])
  }

  let raw: string
  let title: string | null = null
  let pages: number | null = null
  switch (kind) {
    case 'pdf': {
      const pdf = await extractPdf(bytes)
      raw = pdf.text
      pages = pdf.pages
      break
    }
    case 'docx':
      raw = await extractDocx(bytes)
      break
    case 'html': {
      const page = htmlToText(decodeTextBytes(bytes, input.charset ?? sniffHtmlCharset(bytes)))
      raw = page.text
      title = page.title
      break
    }
    default:
      raw = decodeTextBytes(bytes, input.charset)
  }

  const text = normalizeDocumentText(raw)
  const readable = text.replace(/\s+/g, '').length
  if (readable === 0 || (kind === 'pdf' && pages !== null && pages > 0 && readable < MIN_CHARS_PER_PAGE * Math.min(pages, 20))) {
    throw new KnowledgeIngestError(kind === 'pdf' ? 'pdf_no_text' : 'empty_document', EMPTY_MESSAGES[kind])
  }
  if (text.length > KNOWLEDGE_MAX_CHARACTERS) {
    throw new KnowledgeIngestError(
      'too_much_text',
      `This document has more text than your agent can use (over ${KNOWLEDGE_MAX_CHARACTERS.toLocaleString('en-US')} characters). Split it into smaller files and upload them separately.`
    )
  }
  if (estimateTokens(text) > KNOWLEDGE_MAX_TOKENS) {
    throw new KnowledgeIngestError(
      'too_much_text',
      'This document has more text than your agent can use in one file. Split it into smaller files and upload them separately.'
    )
  }
  return { text, title, pages }
}
