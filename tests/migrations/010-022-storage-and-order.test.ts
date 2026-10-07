import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks: the storage DDL of 010 (and the policy rewrite of 022) must
// not abort the migration where the migration role does not own
// storage.objects, and the former 011 runs last (022), after the app deploy.

const dir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const read = (f: string) => readFileSync(`${dir}${f}`, 'utf8')
const code = (sql: string) =>
  sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')

describe('migration 010 storage section', () => {
  const section = code(read('010_voice_providers.sql')).split('DO $$ BEGIN\n  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = \'storage\') THEN')[1]?.split('END $$;')[0] ?? ''

  it('guards every storage statement with EXCEPTION WHEN insufficient_privilege (NOTICE, no abort)', () => {
    expect(section).toContain('UPDATE storage.buckets')
    expect(section).toContain('CREATE POLICY "knowledge_docs_owner" ON storage.objects')
    // Two guarded sub-blocks: the bucket limit, and the policy swap (DROPs and CREATE roll back together).
    const blocks = section.split(/\n\s*BEGIN\n/).slice(1)
    expect(blocks).toHaveLength(2)
    for (const b of blocks) {
      expect(b).toMatch(/EXCEPTION WHEN insufficient_privilege THEN\s+RAISE NOTICE/)
    }
    expect(blocks[1]).toMatch(/DROP POLICY IF EXISTS "knowledge_docs_rw"[\s\S]*DROP POLICY IF EXISTS "knowledge_docs_owner"[\s\S]*CREATE POLICY "knowledge_docs_owner"[\s\S]*EXCEPTION WHEN insufficient_privilege/)
  })
})

describe('022 (formerly 011) security hardening', () => {
  it('is renumbered: 011 is gone, 022 sorts after every migration the new app needs', () => {
    expect(existsSync(`${dir}011_security_performance_hardening.sql`)).toBe(false)
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    expect(files.at(-1)).toBe('022_security_performance_hardening.sql')
    expect(files.map((f) => f.slice(0, 3))).not.toContain('011')
    expect(read('022_security_performance_hardening.sql')).toMatch(/^-- 022 · Security & performance hardening/m)
  })

  it('stays additive and re-runnable, and guards its storage policy rewrite', () => {
    const sql = code(read('022_security_performance_hardening.sql'))
    expect(sql).not.toMatch(/\bdrop\b/i)
    const storage = sql.split("policyname = 'knowledge_docs_owner'")[1]?.split('END $$;')[0] ?? ''
    expect(storage).toMatch(/ALTER POLICY "knowledge_docs_owner" ON storage\.objects[\s\S]*EXCEPTION WHEN insufficient_privilege THEN\s+RAISE NOTICE/)
  })

  it('no document or script still points at the old file name', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url))
    for (const f of ['README.md', 'docs/voice-providers.md', 'supabase/RUN_MISSING_MIGRATIONS.sql']) {
      const text = readFileSync(`${root}${f}`, 'utf8')
      for (const m of text.matchAll(/011_security_performance_hardening\.sql/g)) {
        // Only as the former name of 022.
        expect(text.slice(Math.max(0, (m.index ?? 0) - 80), m.index), f).toMatch(/022|former/i)
      }
      expect(text, f).not.toMatch(/001 → 011|then 011 afterwards/)
    }
  })
})
