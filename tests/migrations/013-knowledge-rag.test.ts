import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 013 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). The tenant
// guard's behaviour was also verified against a throwaway Postgres 16
// (see docs/elevenlabs/E.md, "Migration verification").

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/013_knowledge_rag.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

describe('migration 013_knowledge_rag', () => {
  it('contains no DROP of any kind', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
  })

  it('is re-runnable: IF NOT EXISTS / OR REPLACE / duplicate_object guards everywhere', () => {
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE TABLE\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE TABLE without IF NOT EXISTS at ${m.index}`)
    expect(code).not.toMatch(/CREATE TRIGGER/)
    expect(code).not.toMatch(/CREATE FUNCTION/)
    // Every ADD CONSTRAINT / CREATE POLICY sits inside a duplicate_object guard.
    const blocks = code.split('DO $$ BEGIN')
    for (const part of blocks.slice(1)) {
      const body = part.split('END $$;')[0]
      if (/ADD CONSTRAINT|CREATE POLICY/.test(body)) expect(body).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL;/)
    }
    const outside = blocks.map((p, i) => (i === 0 ? p : p.split('END $$;').slice(1).join(''))).join('')
    expect(outside).not.toMatch(/ADD CONSTRAINT|CREATE POLICY/)
  })

  it('does not redefine guard_platform_columns; its own guard has a fixed search_path and is not executable by tenants', () => {
    expect(code).not.toMatch(/guard_platform_columns/)
    expect(code).toMatch(/CREATE OR REPLACE FUNCTION public\.guard_knowledge_columns\(\)[\s\S]*?SET search_path = public/)
    expect(code).toMatch(/REVOKE EXECUTE ON FUNCTION public\.guard_knowledge_columns\(\) FROM PUBLIC, anon, authenticated;/)
    expect(code).toMatch(/IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER knowledge_documents_guard_knowledge\s+BEFORE INSERT OR UPDATE ON public\.knowledge_documents/)
  })

  it('locks every column of knowledge documents for tenant updates (sizes, type, usage mode, RAG state…)', () => {
    expect(code).toMatch(/\(to_jsonb\(NEW\) - 'updated_at'\) IS DISTINCT FROM \(to_jsonb\(OLD\) - 'updated_at'\)/)
    for (const col of ['usage_mode', 'rag_status', 'rag_progress', 'rag_model', 'rag_index_id', 'rag_used_bytes', 'auto_sync', 'sync_frequency_days', 'elevenlabs_folder_id', 'deleting_at', 'pending_storage_path', 'attempt_count']) {
      expect(code, col).toMatch(new RegExp(`NEW\\.${col} IS`))
    }
  })

  it('new tables: RLS on, tenant SELECT scoped by org with (SELECT auth.uid()), no tenant writes', () => {
    for (const table of ['knowledge_crawls', 'knowledge_folders']) {
      expect(code).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`))
      expect(code).toMatch(new RegExp(`CREATE POLICY "${table}_owner_select" ON public\\.${table} FOR SELECT\\s+USING \\(org_id IN \\(SELECT id FROM public\\.organizations WHERE user_id = \\(SELECT auth\\.uid\\(\\)\\)\\)\\);`))
      expect(code).toMatch(new RegExp(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\\.${table} FROM anon, authenticated;`))
      expect(code).not.toMatch(new RegExp(`CREATE POLICY [^;]*ON public\\.${table} FOR (INSERT|UPDATE|DELETE|ALL)`))
    }
  })

  it('one running crawl per organization and a hard page cap', () => {
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS knowledge_crawls_one_active\s+ON public\.knowledge_crawls \(org_id\)\s+WHERE status IN \('starting', 'queued', 'processing'\)/)
    expect(code).toMatch(/CHECK \(max_pages BETWEEN 1 AND 50\)/)
  })
})
