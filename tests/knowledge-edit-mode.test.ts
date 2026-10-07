import { describe, expect, it } from 'vitest'
import { canEditDocumentText } from '@/components/agent/knowledge/EditDocumentDialog'
import type { KnowledgeDoc } from '@/hooks/useKnowledge'

// The edit dialog offers the text editor only when PATCH
// /api/agent/knowledge/[docId] accepts a text edit (assertEditable: ready and
// on the agent); otherwise it opens in rename-only mode, which the route
// accepts for failed or not-uploaded documents.

function doc(patch: Partial<KnowledgeDoc>): KnowledgeDoc {
  return {
    id: 'd1',
    agent_id: 'a1',
    org_id: 'o1',
    name: 'Prices',
    type: 'text',
    status: 'ready',
    elevenlabs_doc_id: 'el_1',
    size_bytes: 10,
    created_at: '2026-01-01T00:00:00Z',
    ...patch,
  } as KnowledgeDoc
}

describe('canEditDocumentText', () => {
  it('allows editing pasted text that is settled on the agent', () => {
    expect(canEditDocumentText(doc({}))).toBe(true)
  })

  it('is rename-only for text that is not on the agent, failed, processing or being deleted', () => {
    expect(canEditDocumentText(doc({ elevenlabs_doc_id: null }))).toBe(false)
    expect(canEditDocumentText(doc({ status: 'failed' }))).toBe(false)
    expect(canEditDocumentText(doc({ status: 'processing' }))).toBe(false)
    expect(canEditDocumentText(doc({ deleting_at: '2026-01-02T00:00:00Z' }))).toBe(false)
  })

  it('never offers a text editor for files or web pages', () => {
    expect(canEditDocumentText(doc({ type: 'pdf' }))).toBe(false)
    expect(canEditDocumentText(doc({ type: 'url' }))).toBe(false)
  })
})
