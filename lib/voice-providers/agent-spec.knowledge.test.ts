import { describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

import { buildAgentSpec, type AgentRow } from './agent-spec'

// The knowledge section of the spec: which documents and website folders the
// provider-side agent lists, with which usage mode, and the fallback excerpt.

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

const agent = {
  id: AGENT, org_id: ORG, name: 'A', language: 'en', system_prompt: null, first_message: null, fallback_message: null, voice_id: null,
  fallback_voice_id: null, is_active: true, metadata: {}, conversation_settings: {}, transfer_settings: {}, analysis_settings: {},
  privacy_settings: {}, voice_settings: {}, dynamic_variables: {}, after_hours: {}, working_hours: {}, config_revision: 4,
  primary_provider: 'elevenlabs', fallback_provider: 'cartesia',
} as unknown as AgentRow

const d = (id: string, extra: Record<string, unknown>) => ({
  id, org_id: ORG, agent_id: AGENT, name: id, type: 'text', status: 'ready', elevenlabs_doc_id: `kb_${id}`, cartesia_doc_id: null,
  usage_mode: 'auto', size_bytes: 1000, deleting_at: null, content_excerpt: null, created_at: `2026-01-0${id.length}`, ...extra,
})

describe('buildAgentSpec — knowledge', () => {
  it('lists ready documents with usage mode and size, leaves out deleting/failed ones and other orgs, adds website folders', async () => {
    const db = memoryDb({
      organizations: [{ id: ORG, name: 'Acme', timezone: 'Europe/Bucharest' }],
      phone_numbers: [],
      knowledge_documents: [
        d('a', { usage_mode: 'prompt', size_bytes: 300, content_excerpt: 'Open 9-5' }),
        d('bb', { deleting_at: '2026-10-07T10:00:00Z' }),
        d('ccc', { status: 'failed', elevenlabs_doc_id: null }),
        d('dddd', { type: 'url', size_bytes: 0 }),
        d('eeeee', { org_id: '99999999-9999-4999-8999-999999999999' }),
      ],
      knowledge_crawls: [
        { id: 'c1', org_id: ORG, agent_id: AGENT, status: 'succeeded', host: 'acme.example', root_folder_id: 'fold_site', content_excerpt: 'About Acme', created_at: '1' },
        { id: 'c2', org_id: ORG, agent_id: AGENT, status: 'processing', host: 'new.example', root_folder_id: 'fold_new', created_at: '2' },
        { id: 'c3', org_id: ORG, agent_id: AGENT, status: 'deleting', host: 'old.example', root_folder_id: 'fold_old', created_at: '3' },
      ],
    })
    const spec = await buildAgentSpec(db as never, agent)
    expect(spec.knowledge).toEqual([
      { name: 'a', type: 'text', elevenlabsId: 'kb_a', cartesiaId: null, usageMode: 'prompt', sizeBytes: 300 },
      { name: 'dddd', type: 'url', elevenlabsId: 'kb_dddd', cartesiaId: null, usageMode: 'auto', sizeBytes: null },
      { name: 'Website: acme.example', type: 'folder', elevenlabsId: 'fold_site', cartesiaId: null, usageMode: 'auto', sizeBytes: null },
    ])
    expect(spec.knowledgeAppendix).toContain('### a\nOpen 9-5')
    expect(spec.knowledgeAppendix).toContain('### Website acme.example\nAbout Acme')
  })
})
