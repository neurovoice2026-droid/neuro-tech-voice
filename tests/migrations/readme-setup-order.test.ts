import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The README's fresh-setup sentence ("apply the SQL files ... in order
// (001 → 021, then 023, ...)") is what someone setting up a new project
// follows: every migration after 021 must be in it, in order, except 022,
// which the README applies separately, after the application deploy.

const root = fileURLToPath(new URL('../../', import.meta.url))
const migrationNumbers = readdirSync(`${root}supabase/migrations`)
  .map((f) => /^(\d{3})_.*\.sql$/.exec(f)?.[1])
  .filter((n): n is string => typeof n === 'string')
  .sort()

describe('README fresh-setup migration list', () => {
  it('lists every migration after 021 except 022, in order', () => {
    const readme = readFileSync(`${root}README.md`, 'utf8')
    const m = /apply the SQL files in `supabase\/migrations\/` in order \(001 → 021,\s+then ([^;]+);/.exec(readme)
    if (!m) throw new Error('README setup sentence not found')
    const listed = [...m[1].matchAll(/\b(\d{3})\b/g)].map((x) => x[1])
    const expected = migrationNumbers.filter((n) => n > '021' && n !== '022')
    expect(expected).toContain('028')
    expect(listed).toEqual(expected)
    // 022 keeps its own instruction (after the deploy).
    expect(readme).toMatch(/\*\*after\*\* deploying the app version that\s+ships it, apply `022_security_performance_hardening\.sql`/)
  })
})
