import { beforeEach, describe, expect, it, vi } from 'vitest'

const unpdf = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}))
const mammoth = vi.hoisted(() => ({
  convertToHtml: vi.fn(),
  extractRawText: vi.fn(),
  images: { imgElement: vi.fn(() => ({ __mammothBrand: 'ImageConverter' })) },
}))

vi.mock('unpdf', () => unpdf)
vi.mock('mammoth', () => ({ default: mammoth }))

import { KnowledgeIngestError } from './errors'
import { decodeTextBytes, extractDocumentText, hasExpectedSignature, sniffHtmlCharset } from './extract'

const encode = (text: string) => new TextEncoder().encode(text)
const PDF_BYTES = encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00])

async function extractError(promise: Promise<unknown>): Promise<KnowledgeIngestError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(KnowledgeIngestError)
    return error as KnowledgeIngestError
  }
  throw new Error('expected extraction to fail')
}

beforeEach(() => {
  vi.clearAllMocks()
  unpdf.getDocumentProxy.mockResolvedValue({ loadingTask: { destroy: vi.fn().mockResolvedValue(undefined) } })
})

describe('text files', () => {
  it('decodes UTF-8 with a BOM and normalises CRLF', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('Program:\r\nLuni–Vineri 9–17\r\n\r\n\r\nSâmbătă închis')])
    const result = await extractDocumentText({ kind: 'txt', bytes })
    expect(result).toEqual({ text: 'Program:\nLuni–Vineri 9–17\n\nSâmbătă închis', title: null, pages: null })
  })

  it('keeps Markdown as written', async () => {
    const result = await extractDocumentText({ kind: 'md', bytes: encode('# Prices\n\n- Cut: **30 EUR**\n') })
    expect(result.text).toBe('# Prices\n\n- Cut: **30 EUR**')
  })

  it('reads UTF-16 files with a BOM', async () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...Array.from('Hi ș').flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8])])
    const result = await extractDocumentText({ kind: 'txt', bytes: utf16 })
    expect(result.text).toBe('Hi ș')
  })

  it('falls back to Windows-1252 for legacy "ANSI" files', () => {
    expect(decodeTextBytes(new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80]))).toBe('Café €')
  })

  it('rejects binary content and empty files', async () => {
    const binary = await extractError(extractDocumentText({ kind: 'txt', bytes: new Uint8Array([0x89, 0x50, 0x00, 0x01]) }))
    expect(binary.code).toBe('wrong_file_type')
    const empty = await extractError(extractDocumentText({ kind: 'md', bytes: encode('  \n\n ') }))
    expect(empty.code).toBe('empty_document')
    expect(empty.message).toBe('This file is empty.')
  })
})

describe('PDF files', () => {
  it('checks the %PDF- signature before parsing', async () => {
    expect(hasExpectedSignature('pdf', PDF_BYTES)).toBe(true)
    expect(hasExpectedSignature('pdf', new Uint8Array([0x00, 0x00, ...PDF_BYTES]))).toBe(true)
    const error = await extractError(extractDocumentText({ kind: 'pdf', bytes: encode('<html>not a pdf</html>') }))
    expect(error.code).toBe('wrong_file_type')
    expect(unpdf.getDocumentProxy).not.toHaveBeenCalled()
  })

  it('extracts merged page text', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 2, text: 'Price list\nHaircut 30 EUR\nColour from 80 EUR, depending on hair length.' })
    const result = await extractDocumentText({ kind: 'pdf', bytes: PDF_BYTES })
    expect(result).toEqual({ text: 'Price list\nHaircut 30 EUR\nColour from 80 EUR, depending on hair length.', title: null, pages: 2 })
    expect(unpdf.extractText).toHaveBeenCalledWith(expect.anything(), { mergePages: true })
  })

  it('explains scanned PDFs with no text', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 3, text: '  \n\n  ' })
    const error = await extractError(extractDocumentText({ kind: 'pdf', bytes: PDF_BYTES }))
    expect(error.code).toBe('pdf_no_text')
    expect(error.message).toMatch(/scanned image/)
  })

  it('treats a few stray characters over many pages as scanned', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 12, text: 'Page 1 Page 2 Page 3' })
    const error = await extractError(extractDocumentText({ kind: 'pdf', bytes: PDF_BYTES }))
    expect(error.code).toBe('pdf_no_text')
  })

  it('explains password-protected PDFs', async () => {
    unpdf.getDocumentProxy.mockRejectedValue(Object.assign(new Error('No password given'), { name: 'PasswordException' }))
    const error = await extractError(extractDocumentText({ kind: 'pdf', bytes: PDF_BYTES }))
    expect(error.code).toBe('pdf_password')
    expect(error.message).toMatch(/password-protected/)
  })

  it('explains damaged PDFs', async () => {
    unpdf.extractText.mockRejectedValue(Object.assign(new Error('Invalid PDF structure'), { name: 'InvalidPDFException' }))
    const error = await extractError(extractDocumentText({ kind: 'pdf', bytes: PDF_BYTES }))
    expect(error.code).toBe('pdf_unreadable')
  })

  it('refuses documents with more text than the agent can use', async () => {
    unpdf.extractText.mockResolvedValue({ totalPages: 400, text: 'word '.repeat(250_000) })
    const error = await extractError(extractDocumentText({ kind: 'pdf', bytes: PDF_BYTES }))
    expect(error.code).toBe('too_much_text')
  })

  it('applies the limit in tokens too, so dense scripts can’t overrun the embedding time', async () => {
    // 350,000 characters of Hindi is ~310,000 tokens (English would be ~90,000).
    const bytes = new TextEncoder().encode('नमस्ते '.repeat(50_000))
    const error = await extractError(extractDocumentText({ kind: 'txt', bytes }))
    expect(error.code).toBe('too_much_text')
  })
})

describe('Word files', () => {
  it('keeps headings and lists through the HTML conversion', async () => {
    mammoth.convertToHtml.mockResolvedValue({ value: '<h1>Policies</h1><p>Cancel 24 hours ahead.</p><ul><li>Deposit 20%</li></ul>', messages: [] })
    const result = await extractDocumentText({ kind: 'docx', bytes: DOCX_BYTES })
    expect(result.text).toBe('# Policies\n\nCancel 24 hours ahead.\n\n- Deposit 20%')
    expect(mammoth.extractRawText).not.toHaveBeenCalled()
  })

  it('keeps Word table rows on one line (cells wrap their text in paragraphs)', async () => {
    // Real mammoth output for its tables.docx fixture.
    mammoth.convertToHtml.mockResolvedValue({
      value: '<p>Above</p><table><tr><td><p>Top left</p></td><td><p>Top right</p></td></tr><tr><td><p>Bottom left</p></td><td><p>Bottom right</p></td></tr></table><p>Below</p>',
      messages: [],
    })
    const result = await extractDocumentText({ kind: 'docx', bytes: DOCX_BYTES })
    expect(result.text).toBe('Above\n\nTop left | Top right\nBottom left | Bottom right\n\nBelow')
  })

  it('falls back to raw text when the HTML has none', async () => {
    mammoth.convertToHtml.mockResolvedValue({ value: '<p></p>', messages: [] })
    mammoth.extractRawText.mockResolvedValue({ value: 'Plain paragraph', messages: [] })
    expect((await extractDocumentText({ kind: 'docx', bytes: DOCX_BYTES })).text).toBe('Plain paragraph')
  })

  it('rejects files that are not zip containers and explains damaged documents', async () => {
    expect((await extractError(extractDocumentText({ kind: 'docx', bytes: PDF_BYTES }))).code).toBe('wrong_file_type')
    mammoth.convertToHtml.mockRejectedValue(new Error("Can't find end of central directory"))
    expect((await extractError(extractDocumentText({ kind: 'docx', bytes: DOCX_BYTES }))).code).toBe('docx_unreadable')
  })
})

describe('web pages', () => {
  it('uses the declared or sniffed charset and returns the title', async () => {
    const latin = new Uint8Array([...encode('<html><head><meta charset="windows-1252"><title>Caf'), 0xe9, ...encode('</title></head><body><p>Men'), 0xfa, ...encode('</p></body></html>')])
    expect(sniffHtmlCharset(latin)).toBe('windows-1252')
    const result = await extractDocumentText({ kind: 'html', bytes: latin })
    expect(result.title).toBe('Café')
    expect(result.text).toBe('Menú')
  })

  it('explains pages whose content is loaded by JavaScript', async () => {
    const error = await extractError(extractDocumentText({ kind: 'html', bytes: encode('<div id="app"></div><script>boot()</script>') }))
    expect(error.message).toMatch(/JavaScript/)
  })
})
