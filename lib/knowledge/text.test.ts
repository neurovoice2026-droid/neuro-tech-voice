import { describe, expect, it } from 'vitest'
import {
  defaultUrlDocumentName,
  knowledgeFileTypeFromName,
  matchStrength,
  normalizeKnowledgeUrl,
  validateKnowledgeFile,
} from './shared'
import {
  estimateTokens,
  normalizeDocumentText,
  splitSentenceRanges,
  splitUtf8Parts,
  truncateText,
  utf8Length,
} from './text'

describe('estimateTokens', () => {
  it('counts four characters per token for alphabetic text and one per CJK character', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('你好世界')).toBe(4)
    expect(estimateTokens('한국어')).toBe(3)
    expect(estimateTokens('😀😀😀😀')).toBe(1)
  })

  it('counts Indic and Thai as one token per character, Cyrillic, Greek and Arabic as two characters per token', () => {
    expect(estimateTokens('नमस्ते')).toBe(6)
    expect(estimateTokens('สวัสดี')).toBe(6)
    expect(estimateTokens('Привет')).toBe(3)
    expect(estimateTokens('مرحبا')).toBe(3)
    expect(estimateTokens('Bună ziua')).toBe(3)
  })
})

describe('normalizeDocumentText', () => {
  it('removes BOMs, CRLF, control characters and extra blank lines', () => {
    const raw = '\ufeffLine one\r\nLine  two   \r\n\r\n\r\n\r\nThird\u0000 line\fFourth\u00a0word\u00ad'
    expect(normalizeDocumentText(raw)).toBe('Line one\nLine two\n\nThird line\nFourth word')
  })

  it('composes decomposed diacritics', () => {
    expect(normalizeDocumentText('s\u0326i t\u0326')).toBe('și ț')
  })
})

describe('splitSentenceRanges', () => {
  it('keeps decimals and version numbers inside a sentence', () => {
    const text = 'A cut costs 3.50 EUR. Version v2.1 is out! Really? Yes…'
    expect(splitSentenceRanges(text).map(([s, e]) => text.slice(s, e))).toEqual([
      'A cut costs 3.50 EUR.',
      'Version v2.1 is out!',
      'Really?',
      'Yes…',
    ])
  })

  it('splits CJK sentences without spaces', () => {
    const text = '你好。今天营业！明天呢？'
    expect(splitSentenceRanges(text).map(([s, e]) => text.slice(s, e))).toEqual(['你好。', '今天营业！', '明天呢？'])
  })
})

describe('splitUtf8Parts', () => {
  it('returns the text whole when it fits', () => {
    expect(splitUtf8Parts('hello', 10)).toEqual(['hello'])
    expect(splitUtf8Parts('  ', 10)).toEqual([])
  })

  it('keeps every part under the byte limit, preferring paragraph boundaries', () => {
    const text = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} ${'ă'.repeat(40)}`).join('\n\n')
    const parts = splitUtf8Parts(text, 300)
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(utf8Length(part)).toBeLessThanOrEqual(300)
    expect(parts.join('\n\n')).toBe(text)
  })

  it('hard-splits text without separators without breaking characters', () => {
    const parts = splitUtf8Parts('😀'.repeat(100), 50)
    for (const part of parts) {
      expect(utf8Length(part)).toBeLessThanOrEqual(50)
      expect(part).not.toMatch(/[\ud800-\udbff]$/)
    }
    expect(parts.join('')).toBe('😀'.repeat(100))
  })
})

describe('utf8Length', () => {
  it('matches TextEncoder', () => {
    for (const s of ['abc', 'ăîșț', '你好', '😀x', '']) {
      expect(utf8Length(s)).toBe(new TextEncoder().encode(s).length)
    }
  })
})

describe('truncateText', () => {
  it('cuts at a word boundary and adds an ellipsis within the limit', () => {
    const out = truncateText('The quick brown fox jumps over the lazy dog', 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out).toBe('The quick brown fox…')
    expect(truncateText('short', 20)).toBe('short')
  })
})

describe('knowledge file validation', () => {
  it('maps extensions', () => {
    expect(knowledgeFileTypeFromName('Price List.PDF')).toBe('pdf')
    expect(knowledgeFileTypeFromName('notes.markdown')).toBe('md')
    expect(knowledgeFileTypeFromName('photo.png')).toBeNull()
    expect(knowledgeFileTypeFromName('noextension')).toBeNull()
  })

  it('explains what is wrong in plain words', () => {
    expect(validateKnowledgeFile({ name: 'menu.pdf', size: 1000, type: 'application/pdf' })).toBeNull()
    expect(validateKnowledgeFile({ name: 'notes.md', size: 10, type: '' })).toBeNull()
    expect(validateKnowledgeFile({ name: 'faq.docx', size: 10, type: 'application/octet-stream' })).toBeNull()
    expect(validateKnowledgeFile({ name: 'old.doc', size: 10, type: 'application/msword' })).toMatch(/older Word file/)
    expect(validateKnowledgeFile({ name: 'photo.png', size: 10, type: 'image/png' })).toMatch(/isn’t a supported file/)
    expect(validateKnowledgeFile({ name: 'big.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' })).toMatch(/11 MB.*10 MB/)
    expect(validateKnowledgeFile({ name: 'empty.txt', size: 0, type: 'text/plain' })).toMatch(/empty/)
    expect(validateKnowledgeFile({ name: 'fake.pdf', size: 10, type: 'image/jpeg' })).toMatch(/doesn’t look like a PDF/)
  })
})

describe('normalizeKnowledgeUrl', () => {
  it('adds https, upgrades http and drops the fragment', () => {
    expect(normalizeKnowledgeUrl('example.com/faq')).toBe('https://example.com/faq')
    expect(normalizeKnowledgeUrl('http://example.com/a#top')).toBe('https://example.com/a')
    expect(normalizeKnowledgeUrl('  https://www.example.ro/preturi  ')).toBe('https://www.example.ro/preturi')
  })

  it('rejects things that are not web addresses', () => {
    expect(normalizeKnowledgeUrl('')).toBeNull()
    expect(normalizeKnowledgeUrl('ftp://example.com/file')).toBeNull()
    expect(normalizeKnowledgeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeKnowledgeUrl('localhost')).toBeNull()
  })

  it('names a page from its address until the title is known', () => {
    expect(defaultUrlDocumentName('https://www.example.com/')).toBe('example.com')
    expect(defaultUrlDocumentName('https://example.com/pricing/')).toBe('example.com/pricing')
  })
})

describe('matchStrength', () => {
  it('buckets similarity', () => {
    expect(matchStrength(0.72)).toBe('strong')
    expect(matchStrength(0.45)).toBe('good')
    expect(matchStrength(0.3)).toBe('possible')
  })
})
