/* In-memory Supabase query-builder fake with real filtering, for tests that
 * exercise several tables (knowledge pipeline, crawls, maintenance). Supports
 * the subset of PostgREST the code under test uses: select/insert/update/
 * upsert/delete, eq/neq/in/is/not(is null)/lt/gt/lte/gte, like (% only), contains (array
 * columns), or (ignored: every row matches), order (by one column), limit,
 * range, single/maybeSingle, head counts. */

type Row = Record<string, unknown>

export interface MemoryDbOptions {
  /** Called for every updated row (e.g. to bump updated_at like the DB trigger). */
  onUpdate?: (table: string, row: Row) => void
  /** Unique keys per table, for upsert(onConflict) and duplicate inserts (23505). */
  unique?: Record<string, string[][]>
}

export function memoryDb(initial: Record<string, Row[]> = {}, opts: MemoryDbOptions = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [k, v] of Object.entries(initial)) tables[k] = v.map((r) => ({ ...r }))
  const log: Array<{ table: string; op: string; payload?: unknown }> = []
  const rpcCalls: Array<{ fn: string; args: unknown }> = []

  class Query {
    private filters: Array<(r: Row) => boolean> = []
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    private payload: Row | Row[] | null = null
    private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    private head = false
    private limitN: number | null = null
    private offsetN = 0
    private orderBy: { col: string; asc: boolean } | null = null
    private returning = false
    constructor(private table: string) {}
    select(_cols?: string, o?: { head?: boolean; count?: string }) {
      if (this.op !== 'select') this.returning = true
      this.head = !!o?.head
      return this
    }
    insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
    update(p: Row) { this.op = 'update'; this.payload = p; return this }
    upsert(p: Row | Row[], o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { this.op = 'upsert'; this.payload = p; this.upsertOpts = o; return this }
    delete() { this.op = 'delete'; return this }
    eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
    neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this }
    in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this }
    is(c: string, v: null) { this.filters.push((r) => (r[c] ?? null) === v); return this }
    not(c: string, op: string, v: unknown) {
      if (op === 'is' && v === null) this.filters.push((r) => (r[c] ?? null) !== null)
      else throw new Error(`memoryDb: unsupported not(${op})`)
      return this
    }
    lt(c: string, v: unknown) { this.filters.push((r) => r[c] !== null && r[c] !== undefined && String(r[c]) < String(v)); return this }
    lte(c: string, v: unknown) { this.filters.push((r) => r[c] !== null && r[c] !== undefined && String(r[c]) <= String(v)); return this }
    gt(c: string, v: unknown) { this.filters.push((r) => r[c] !== null && r[c] !== undefined && String(r[c]) > String(v)); return this }
    gte(c: string, v: unknown) { this.filters.push((r) => r[c] !== null && r[c] !== undefined && String(r[c]) >= String(v)); return this }
    or() { return this }
    /** SQL LIKE with % wildcards only (no _ or escapes). */
    like(c: string, pattern: string) {
      const re = new RegExp(`^${pattern.split('%').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
      this.filters.push((r) => typeof r[c] === 'string' && re.test(r[c] as string))
      return this
    }
    /** Array column contains every given value. */
    contains(c: string, v: unknown[]) { this.filters.push((r) => Array.isArray(r[c]) && v.every((x) => (r[c] as unknown[]).includes(x))); return this }
    order(col: string, o: { ascending?: boolean } = {}) { this.orderBy = { col, asc: o.ascending !== false }; return this }
    limit(n: number) { this.limitN = n; return this }
    range(from: number, to: number) { this.offsetN = from; this.limitN = to - from + 1; return this }

    private conflictKeys(): string[][] {
      if (this.upsertOpts.onConflict) return [this.upsertOpts.onConflict.split(',').map((s) => s.trim())]
      return opts.unique?.[this.table] ?? [['id']]
    }

    private run(): { data: unknown; error: { message: string; code?: string } | null; count: number | null } {
      const rows = (tables[this.table] ??= [])
      log.push({ table: this.table, op: this.op, payload: this.payload })
      if (this.op === 'insert' || this.op === 'upsert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row]
        const out: Row[] = []
        for (const item of items) {
          const keys = this.conflictKeys()
          const clash = rows.find((r) => keys.some((k) => k.every((c) => item[c] !== undefined && r[c] === item[c])))
          if (clash) {
            if (this.op === 'insert') return { data: null, error: { message: 'duplicate key', code: '23505' }, count: null }
            if (this.upsertOpts.ignoreDuplicates) continue
            Object.assign(clash, item)
            out.push({ ...clash })
            continue
          }
          const row = { id: item.id ?? `row-${rows.length + 1}-${Math.random().toString(16).slice(2, 8)}`, ...item }
          rows.push(row)
          out.push({ ...row })
        }
        return { data: out, error: null, count: null }
      }
      let hit = rows.filter((r) => this.filters.every((f) => f(r)))
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        hit = [...hit].sort((a, b) => {
          const av = a[col] ?? ''
          const bv = b[col] ?? ''
          return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1)
        })
      }
      if (this.limitN !== null) hit = hit.slice(this.offsetN, this.offsetN + this.limitN)
      if (this.op === 'delete') {
        tables[this.table] = rows.filter((r) => !hit.includes(r))
        return { data: null, error: null, count: hit.length }
      }
      if (this.op === 'update') {
        for (const r of hit) {
          Object.assign(r, this.payload)
          opts.onUpdate?.(this.table, r)
        }
        return { data: this.returning ? hit.map((r) => ({ ...r })) : null, error: null, count: hit.length }
      }
      return { data: this.head ? null : hit.map((r) => ({ ...r })), error: null, count: hit.length }
    }
    maybeSingle() {
      const r = this.run()
      return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: r.error })
    }
    single() {
      const r = this.run()
      const row = (r.data as Row[] | null)?.[0] ?? null
      return Promise.resolve({ data: row, error: r.error ?? (row ? null : { message: 'no rows' }) })
    }
    then<A, B = never>(res: (v: { data: unknown; error: { message: string; code?: string } | null; count: number | null }) => A, rej?: (e: unknown) => B) {
      return Promise.resolve(this.run()).then(res, rej)
    }
  }

  return {
    tables,
    log,
    rpcCalls,
    from: (t: string) => new Query(t),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: 2, error: null })
    },
  }
}

export type MemoryDb = ReturnType<typeof memoryDb>
