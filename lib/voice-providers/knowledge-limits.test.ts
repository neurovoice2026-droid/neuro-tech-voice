import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'
import {
  assertBytesFit,
  assertDocumentsFit,
  crawlMaxPages,
  orgByteBudget,
  orgKnowledgeUsage,
  promptCharBudget,
  syncFrequencyDays,
} from './knowledge-limits'

const ORG = 'org-1'
afterEach(() => vi.unstubAllEnvs())

describe('env limits', () => {
  it('defaults and bounds', () => {
    expect(orgByteBudget()).toBe(50 * 1024 * 1024)
    expect(promptCharBudget()).toBe(8_000)
    expect(crawlMaxPages()).toBe(25)
    expect(syncFrequencyDays()).toBe(7)
    vi.stubEnv('ELEVENLABS_CRAWL_MAX_PAGES', '50')
    expect(crawlMaxPages()).toBe(50)
    vi.stubEnv('ELEVENLABS_CRAWL_MAX_PAGES', '51')
    expect(crawlMaxPages()).toBe(25)
    vi.stubEnv('ELEVENLABS_CRAWL_MAX_PAGES', 'lots')
    expect(crawlMaxPages()).toBe(25)
    vi.stubEnv('ELEVENLABS_KB_SYNC_DAYS', '181')
    expect(syncFrequencyDays()).toBe(7)
    vi.stubEnv('KNOWLEDGE_ORG_MAX_BYTES', '100')
    expect(orgByteBudget()).toBe(50 * 1024 * 1024)
  })
})

describe('orgKnowledgeUsage', () => {
  it('sums server-written sizes, skips deleting documents, reserves running crawls and counts prompt characters', async () => {
    const db = memoryDb({
      knowledge_documents: [
        { org_id: ORG, size_bytes: 1000, character_count: 300, usage_mode: 'prompt', deleting_at: null },
        { org_id: ORG, size_bytes: 2000, character_count: 900, usage_mode: 'auto', deleting_at: null },
        { org_id: ORG, size_bytes: 5000, character_count: 900, usage_mode: 'prompt', deleting_at: '2026-10-07' },
        { org_id: 'other', size_bytes: 9999, character_count: 1, usage_mode: 'prompt', deleting_at: null },
      ],
      knowledge_crawls: [
        { org_id: ORG, status: 'processing', max_pages: 10, size_bytes: 0, page_count: 0 },
        { org_id: ORG, status: 'succeeded', max_pages: 25, size_bytes: 7000, page_count: 4 },
        { org_id: ORG, status: 'failed', max_pages: 25, size_bytes: 0, page_count: 0 },
      ],
    })
    const u = await orgKnowledgeUsage(db as never, ORG, 100)
    expect(u).toMatchObject({ bytesUsed: 1000 + 2000 + 10 * 100 * 1024 + 7000, documents: 2 + 10 + 4, promptChars: 300, websites: 2 })
  })
  it('assertions reject over-budget additions with a 409 the owner can act on', () => {
    const usage = { bytesUsed: 900, bytesLimit: 1000, documents: 99, documentsLimit: 100, promptChars: 0, promptCharsLimit: 10, websites: 0 }
    expect(() => assertBytesFit(usage, 100)).not.toThrow()
    expect(() => assertBytesFit(usage, 101)).toThrow(/knowledge base is full/)
    expect(() => assertBytesFit({ ...usage, bytesUsed: 1000 }, 0)).toThrow()
    expect(() => assertDocumentsFit(usage, 1)).not.toThrow()
    expect(() => assertDocumentsFit(usage, 2)).toThrow(/100 documents/)
  })
})
