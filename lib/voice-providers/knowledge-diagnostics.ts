import 'server-only'
// Knowledge-base section of the platform-admin diagnostics: the shared
// workspace's RAG quota (GET /rag-index, never shown to tenants), document and
// website-import states across organizations, and invalid RAG tuning env.

import { createAdminClient } from '@/lib/supabase/admin'
import * as el from '@/lib/elevenlabs/client'
import { ragTuning, ragTuningProblems } from '@/lib/elevenlabs/rag-config'
import { describeError, type Logger } from '@/lib/observability/logger'
import { getRagOverview, quotaRatio } from './knowledge-rag'
import { crawlMaxPages, orgByteBudget, promptCharBudget } from './knowledge-limits'

export async function knowledgeDiagnostics(log: Logger) {
  const db = createAdminClient()
  const [docs, crawls] = await Promise.all([
    db.from('knowledge_documents').select('status, rag_status, usage_mode, deleting_at, elevenlabs_folder_id, elevenlabs_doc_id').limit(10_000),
    db.from('knowledge_crawls').select('status').limit(5_000),
  ])
  if (docs.error) throw new Error(`knowledge_documents diagnostics read failed: ${docs.error.message}`)
  if (crawls.error) throw new Error(`knowledge_crawls diagnostics read failed: ${crawls.error.message}`)

  const count = (map: Record<string, number>, key: string) => {
    map[key] = (map[key] ?? 0) + 1
  }
  const byStatus: Record<string, number> = {}
  const byRag: Record<string, number> = {}
  let prompt = 0
  let deleting = 0
  let atRoot = 0
  for (const d of docs.data ?? []) {
    count(byStatus, String(d.status))
    count(byRag, d.rag_status ? String(d.rag_status) : 'unknown')
    if (d.usage_mode === 'prompt') prompt++
    if (d.deleting_at) deleting++
    if (d.elevenlabs_doc_id && !d.elevenlabs_folder_id) atRoot++
  }
  const crawlStatus: Record<string, number> = {}
  for (const c of crawls.data ?? []) count(crawlStatus, String(c.status))

  let ragQuota: Record<string, unknown> = { available: false }
  if (el.isConfigured()) {
    try {
      const o = await getRagOverview(60_000)
      const ratio = quotaRatio(o)
      ragQuota = {
        available: true,
        used_bytes: o.total_used_bytes,
        max_bytes: o.total_max_bytes,
        used_pct: ratio === null ? null : Math.round(ratio * 1000) / 10,
        models: (o.models ?? []).map((m) => ({ model: m.model, used_bytes: m.used_bytes })),
      }
    } catch (err) {
      log.warn('admin.diagnostics_rag_overview_failed', { error: describeError(err) })
      ragQuota = { available: false, error: 'rag overview unavailable' }
    }
  }

  return {
    rag_quota: ragQuota,
    rag_tuning: ragTuning(),
    problems: ragTuningProblems(),
    limits: { org_bytes: orgByteBudget(), prompt_chars: promptCharBudget(), crawl_max_pages: crawlMaxPages() },
    documents: { by_status: byStatus, by_rag_status: byRag, prompt_mode: prompt, deleting, at_workspace_root: atRoot },
    website_imports: crawlStatus,
  }
}
