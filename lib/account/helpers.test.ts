// Storage prefix safety, Google revoke and the orphan-agent knowledge cleanup.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {} }))
vi.mock('@/lib/voice-providers/knowledge', () => ({ KNOWLEDGE_BUCKET: 'knowledge-documents' }))

import { deleteOrgStorage } from './steps/storage'
import { GoogleRevokeError, revokeGoogleToken } from './google-revoke'
import { deleteOrphanAgentKnowledge } from './orphan-knowledge'

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }

let fetchMock: FetchMock
beforeEach(() => {
  fetchMock = installFetch()
  vi.stubEnv('ELEVENLABS_API_KEY', 'test-el-key')
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
})

describe('deleteOrgStorage', () => {
  function storage(list: Record<string, Array<{ name: string; id: string | null }>>) {
    const removed: string[][] = []
    const listed: string[] = []
    return {
      removed,
      listed,
      db: {
        storage: {
          from: (bucket: string) => {
            expect(bucket).toBe('knowledge-documents')
            return {
              list: async (prefix: string) => (listed.push(prefix), { data: list[prefix] ?? [], error: null }),
              remove: async (paths: string[]) => (removed.push(paths), { data: [], error: null }),
            }
          },
        },
      } as never,
    }
  }

  it('lists and removes only under <org_id>/, recursively', async () => {
    const s = storage({
      [ORG]: [{ name: 'agent-1', id: null }, { name: 'loose.txt', id: 'f0' }],
      [`${ORG}/agent-1`]: [{ name: 'menu.pdf', id: 'f1' }, { name: '..', id: 'f2' }],
    })
    const res = await deleteOrgStorage(s.db, ORG)
    expect(res).toEqual({ removed: 2, more: false })
    expect(s.listed).toEqual([ORG, `${ORG}/agent-1`])
    expect(s.removed.flat().sort()).toEqual([`${ORG}/agent-1/menu.pdf`, `${ORG}/loose.txt`])
    expect(s.removed.flat().some((p) => p.includes(OTHER))).toBe(false)
  })

  it('refuses anything but an organization uuid (never an empty or root prefix)', async () => {
    const s = storage({})
    await expect(deleteOrgStorage(s.db, '')).rejects.toThrow(/invalid organization id/)
    await expect(deleteOrgStorage(s.db, '../')).rejects.toThrow(/invalid organization id/)
    expect(s.listed).toEqual([])
  })
})

describe('revokeGoogleToken', () => {
  it('posts the token form-encoded, never in the URL; 200 revoked, 400 already invalid', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    expect(await revokeGoogleToken('tok/+=1')).toBe('revoked')
    const call = callAt(fetchMock, 0)
    expect(call.url.href).toBe('https://oauth2.googleapis.com/revoke')
    expect(call.method).toBe('POST')
    expect(call.headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(call.rawBody).toBe('token=tok%2F%2B%3D1')
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid_token"}', { status: 400 }))
    expect(await revokeGoogleToken('old')).toBe('already_invalid')
  })

  it('5xx and network failures throw an error without the token', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    const err = await revokeGoogleToken('secret-token').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GoogleRevokeError)
    expect((err as GoogleRevokeError).status).toBe(503)
    expect(String((err as Error).message)).not.toContain('secret-token')
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(revokeGoogleToken('secret-token')).rejects.toMatchObject({ status: null })
  })
})

describe('deleteOrphanAgentKnowledge (reconcile)', () => {
  let db: MemoryDb
  beforeEach(() => {
    db = memoryDb({
      // doc_live is still used by a live organization: never deleted.
      knowledge_documents: [{ id: 'k1', org_id: OTHER, elevenlabs_doc_id: 'doc_live' }],
      knowledge_crawls: [],
      knowledge_folders: [],
    })
    state.db = db
  })

  it('bulk-deletes only the orphan agent’s documents that no row references', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname === '/v1/convai/agents/agent_orphan') {
        return jsonResponse({
          agent_id: 'agent_orphan',
          name: 'x',
          conversation_config: { agent: { prompt: { knowledge_base: [{ type: 'file', name: 'a', id: 'doc_orphan' }, { type: 'file', name: 'b', id: 'doc_live' }, { type: 'folder', name: 'c', id: 'fold_orphan' }] } } },
        })
      }
      if (url.pathname === '/v1/convai/knowledge-base/bulk-delete') {
        return jsonResponse({ doc_orphan: { status: 'success', data: { id: 'doc_orphan' } }, fold_orphan: { status: 'failure', error_code: 404, error_status: 'not_found', error_message: 'x' } })
      }
      return jsonResponse({}, 418)
    })
    const report = await deleteOrphanAgentKnowledge('agent_orphan', log)
    expect(report).toEqual({ found: 3, deleted: 2, kept: 1, failed: 0 })
    const bulk = fetchMock.mock.calls.map((_, i) => callAt(fetchMock, i)).find((c) => c.url.pathname.endsWith('/bulk-delete'))
    expect(bulk?.json).toEqual({ document_ids: ['doc_orphan', 'fold_orphan'], force: true })
  })

  it('an agent that is already gone has nothing to clean; other failures are reported, never thrown', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: { status: 'not_found' } }, 404))
    expect(await deleteOrphanAgentKnowledge('agent_gone', log)).toEqual({ found: 0, deleted: 0, kept: 0, failed: 0 })
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'bad' }, 422))
    expect((await deleteOrphanAgentKnowledge('agent_bad', log)).failed).toBe(1)
  })
})
