import { describe, expect, it } from 'vitest'
import { olderThan, ORPHAN_MIN_AGE_MS, unreferencedKnowledgeFiles } from './storage-cleanup'

const NOW = Date.parse('2026-09-17T07:00:00Z')

describe('storage cleanup selection', () => {
  it('only picks files older than a day, never files without a timestamp', () => {
    const files = [
      { path: 'org/a.wav', createdAt: new Date(NOW - ORPHAN_MIN_AGE_MS - 1000).toISOString() },
      { path: 'org/b.wav', createdAt: new Date(NOW - 60_000).toISOString() },
      { path: 'org/c.wav', createdAt: null },
    ]
    expect(olderThan(files, NOW - ORPHAN_MIN_AGE_MS).map((f) => f.path)).toEqual(['org/a.wav'])
  })

  it('keeps knowledge files a document still uses and every extracted text', () => {
    const files = [
      { path: 'org/agent/1-price-list.pdf', createdAt: null },
      { path: 'org/agent/2-abandoned.pdf', createdAt: null },
      { path: 'org/agent/extracted/doc.txt', createdAt: null },
    ]
    expect(unreferencedKnowledgeFiles(files, new Set(['org/agent/1-price-list.pdf'])).map((f) => f.path)).toEqual(['org/agent/2-abandoned.pdf'])
  })
})
