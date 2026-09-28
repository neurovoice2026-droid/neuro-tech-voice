import { describe, expect, it } from 'vitest'
import { chunkDocument, embeddingInputFor } from './chunk'
import { estimateTokens } from './text'

function paragraph(seed: string, sentences: number): string {
  return Array.from({ length: sentences }, (_, i) => `${seed} sentence number ${i + 1} explains one more detail for callers.`).join(' ')
}

describe('chunkDocument', () => {
  it('returns nothing for empty text', () => {
    expect(chunkDocument('')).toEqual([])
    expect(chunkDocument('   \n\n  ')).toEqual([])
  })

  it('keeps a short document in one chunk without a heading', () => {
    const chunks = chunkDocument('We are open Monday to Friday, 9:00 to 18:00.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ index: 0, heading: null, content: 'We are open Monday to Friday, 9:00 to 18:00.' })
    expect(chunks[0].token_count).toBe(estimateTokens(chunks[0].content))
  })

  it('splits at Markdown headings and keeps the heading trail', () => {
    const text = [
      '# Prices',
      'All prices include VAT.',
      '',
      '## Haircuts',
      'Women: 45 EUR. Men: 30 EUR.',
      '',
      '## Colour',
      'Full colour from 80 EUR.',
      '',
      '# Cancellation policy',
      'Cancel at least 24 hours ahead.',
    ].join('\n')
    const chunks = chunkDocument(text)
    expect(chunks.map((c) => [c.heading, c.content])).toEqual([
      ['Prices', 'All prices include VAT.'],
      ['Prices › Haircuts', 'Women: 45 EUR. Men: 30 EUR.'],
      ['Prices › Colour', 'Full colour from 80 EUR.'],
      ['Cancellation policy', 'Cancel at least 24 hours ahead.'],
    ])
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2, 3])
  })

  it('recognises setext, numbered and all-caps headings but never lines with prices or hours', () => {
    const text = [
      'Opening hours',
      '=============',
      'MONDAY 9-17',
      '',
      'PARKING',
      '',
      'Free parking behind the building.',
      '',
      '2.1 Refunds',
      'Refunds take five working days.',
      '',
      'Prices:',
      '- Consultation 50 EUR',
    ].join('\n')
    const chunks = chunkDocument(text)
    expect(chunks.map((c) => c.heading)).toEqual([
      'Opening hours',
      'Opening hours › PARKING',
      // Section numbers stay: owners and documents refer to them.
      'Opening hours › PARKING › 2.1 Refunds',
      // "Prices:" is a level-3 heading like "2.1 Refunds", so it replaces it.
      'Opening hours › PARKING › Prices',
    ])
    expect(chunks[0].content).toBe('MONDAY 9-17')
    expect(chunks[3].content).toBe('- Consultation 50 EUR')
  })

  it('does not turn numbered list items into headings', () => {
    const chunks = chunkDocument('Before your visit:\n\n1. Bring your ID\n2. Arrive ten minutes early')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].heading).toBe('Before your visit')
    expect(chunks[0].content).toContain('1. Bring your ID')
  })

  it('keeps a heading-shaped last line as content', () => {
    const chunks = chunkDocument('We look forward to seeing you.\n\nTHANK YOU FOR CHOOSING US')
    const all = chunks.map((c) => c.content).join('\n')
    expect(all).toContain('THANK YOU FOR CHOOSING US')
  })

  it('packs long sections into ~500-token chunks with ~15% overlap', () => {
    const text = ['# Services', ...Array.from({ length: 30 }, (_, i) => paragraph(`Service ${i + 1}`, 4))].join('\n\n')
    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) {
      expect(chunk.heading).toBe('Services')
      expect(chunk.token_count).toBeLessThanOrEqual(500 * 1.25)
    }
    for (let i = 1; i < chunks.length; i++) {
      const previousParagraphs = chunks[i - 1].content.split('\n\n')
      const lastOfPrevious = previousParagraphs[previousParagraphs.length - 1]
      // The next chunk starts with the tail of the previous one.
      expect(chunks[i].content.startsWith(lastOfPrevious) || chunks[i].content.includes(lastOfPrevious.slice(-60))).toBe(true)
    }
    // Every paragraph appears somewhere.
    const joined = chunks.map((c) => c.content).join('\n')
    for (let i = 1; i <= 30; i++) expect(joined).toContain(`Service ${i} sentence number 4`)
  })

  it('does not carry overlap across sections', () => {
    const text = `# A\n\n${paragraph('Alpha', 60)}\n\n# B\n\nShort section.`
    const chunks = chunkDocument(text)
    const b = chunks.filter((c) => c.heading === 'B')
    expect(b).toHaveLength(1)
    expect(b[0].content).toBe('Short section.')
  })

  it('splits one very long paragraph by sentences and keeps every sentence', () => {
    const long = paragraph('Policy', 200)
    const chunks = chunkDocument(long)
    expect(chunks.length).toBeGreaterThan(5)
    for (const chunk of chunks) expect(chunk.token_count).toBeLessThanOrEqual(500 * 1.25)
    const joined = chunks.map((c) => c.content).join(' ')
    for (const n of [1, 50, 137, 200]) expect(joined).toContain(`Policy sentence number ${n} explains`)
  })

  it('hard-splits a single enormous word', () => {
    const chunks = chunkDocument('x'.repeat(10_000))
    expect(chunks.length).toBeGreaterThan(4)
    for (const chunk of chunks) expect(chunk.token_count).toBeLessThanOrEqual(500 * 1.25)
  })

  it('chunks CJK text by sentence without inserting spaces', () => {
    const sentence = '我们的营业时间是周一至周五上午九点到下午六点。'
    const text = `# 营业时间\n\n${sentence.repeat(120)}`
    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) {
      expect(chunk.heading).toBe('营业时间')
      expect(chunk.content).not.toMatch(/。 /)
      // CJK characters count about one token each.
      expect(chunk.token_count).toBeGreaterThanOrEqual(chunk.content.length * 0.9)
      expect(chunk.token_count).toBeLessThanOrEqual(500 * 1.25)
    }
  })

  it('handles CJK text with no punctuation at all', () => {
    const chunks = chunkDocument('営業時間'.repeat(600))
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) expect(chunk.token_count).toBeLessThanOrEqual(500 * 1.25)
  })

  it('keeps Hindi chunks small enough for the embedding token limits', () => {
    const sentence = 'हमारा सैलून सोमवार से शनिवार तक सुबह नौ बजे से शाम सात बजे तक खुला रहता है। '
    const chunks = chunkDocument(sentence.repeat(300))
    expect(chunks.length).toBeGreaterThan(20)
    // About one token per Devanagari character, so a ~500-token chunk is ~600 characters, not ~2,000.
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(800)
  })

  it('respects a custom target size', () => {
    const chunks = chunkDocument(paragraph('Small', 40), { targetTokens: 100, overlapRatio: 0 })
    for (const chunk of chunks) expect(chunk.token_count).toBeLessThanOrEqual(125)
    expect(chunks.length).toBeGreaterThan(3)
  })
})

describe('embeddingInputFor', () => {
  it('prefixes the document name and heading', () => {
    expect(embeddingInputFor({ heading: 'Prices › Colour', content: 'From 80 EUR.' }, 'Price list.pdf')).toBe(
      'Price list.pdf\nPrices › Colour\n\nFrom 80 EUR.'
    )
    expect(embeddingInputFor({ heading: null, content: 'Hello' }, '')).toBe('Hello')
  })
})
