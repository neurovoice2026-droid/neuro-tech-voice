import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { env, isSupabaseAdminConfigured, isUpstashConfigured } from '@/lib/env'

// Small key-value store for rate limits, the circuit breaker and short caches.
// Backends in order:
//   1. Upstash Redis over REST (atomic, shared by every serverless instance)
//   2. Supabase public.kv_store through the service-role client
//   3. an in-memory Map (per instance; last resort so nothing breaks)
// No function here throws. A failing backend is logged once per failure type,
// skipped for a short cooldown (so a dead Redis doesn't add 1.5 s to every
// request) and the call falls through to the next backend. Values written
// during an outage live in the fallback store only; for counters and caches
// with short TTLs that inconsistency is acceptable.

const UPSTASH_TIMEOUT_MS = 1500
const UPSTASH_COOLDOWN_MS = 30_000
const SUPABASE_COOLDOWN_MS = 30_000
// A missing table won't appear by itself within seconds; check again later.
const SUPABASE_MISSING_TABLE_COOLDOWN_MS = 5 * 60_000
const MEMORY_MAX_ENTRIES = 10_000

type Backend = 'upstash' | 'supabase'

const disabledUntil: Record<Backend, number> = { upstash: 0, supabase: 0 }
const loggedFailures = new Set<string>()

function logFailureOnce(backend: Backend | 'memory', type: string, error?: unknown): void {
  const id = `${backend}:${type}`
  if (loggedFailures.has(id)) return
  loggedFailures.add(id)
  const detail = error instanceof Error ? error.message : error ? String(error) : ''
  console.warn('[kv]', `${backend} unavailable (${type}); falling back`, detail)
}

function backendFailed(backend: Backend, type: string, error: unknown, cooldownMs: number): void {
  disabledUntil[backend] = Date.now() + cooldownMs
  logFailureOnce(backend, type, error)
}

function ttl(seconds: number): number {
  return Math.max(1, Math.ceil(seconds))
}

// ─── Upstash ─────────────────────────────────────────────────────────────────

type RedisArg = string | number

class UpstashError extends Error {}

async function upstashPipeline(commands: RedisArg[][]): Promise<unknown[]> {
  const base = (env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/+$/, '')
  const res = await fetch(`${base}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
  })
  if (!res.ok) throw new UpstashError(`HTTP ${res.status}`)
  const data = (await res.json()) as unknown
  if (!Array.isArray(data) || data.length !== commands.length) {
    throw new UpstashError('unexpected pipeline response')
  }
  return data.map((entry) => {
    const item = entry as { result?: unknown; error?: unknown }
    if (item && typeof item === 'object' && 'error' in item && item.error) {
      throw new UpstashError(String(item.error))
    }
    return item?.result ?? null
  })
}

function upstashAvailable(): boolean {
  return isUpstashConfigured() && Date.now() >= disabledUntil.upstash
}

function upstashFailureType(error: unknown): string {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout'
  if (error instanceof UpstashError) return error.message.startsWith('HTTP') ? error.message : 'command_error'
  return 'network'
}

// ─── Supabase kv_store ───────────────────────────────────────────────────────

interface KvRow {
  value: unknown
  expires_at: string | null
}

class SupabaseKvError extends Error {
  readonly missingTable: boolean
  constructor(message: string, missingTable: boolean) {
    super(message)
    this.missingTable = missingTable
  }
}

function toSupabaseError(error: { code?: string; message?: string } | null): SupabaseKvError | null {
  if (!error) return null
  // 42P01 = undefined_table (Postgres); PGRST205 = table not in PostgREST's schema cache.
  const missing = error.code === '42P01' || error.code === 'PGRST205'
  return new SupabaseKvError(error.message ?? 'Supabase error', missing)
}

function supabaseAvailable(): boolean {
  return isSupabaseAdminConfigured() && Date.now() >= disabledUntil.supabase
}

function supabaseFailed(error: unknown): void {
  const missing = error instanceof SupabaseKvError && error.missingTable
  backendFailed(
    'supabase',
    missing ? 'missing_table' : 'error',
    error,
    missing ? SUPABASE_MISSING_TABLE_COOLDOWN_MS : SUPABASE_COOLDOWN_MS
  )
}

function isExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false
  const at = Date.parse(expiresAt)
  return Number.isFinite(at) && at <= now
}

async function supabaseGetRow(key: string): Promise<KvRow | null> {
  const { data, error } = await createAdminClient()
    .from('kv_store')
    .select('value, expires_at')
    .eq('key', key)
    .maybeSingle()
  const failure = toSupabaseError(error)
  if (failure) throw failure
  const row = data as KvRow | null
  // Expired rows are left for the daily purge; to readers they don't exist.
  return row && !isExpired(row.expires_at) ? row : null
}

async function supabaseUpsert(key: string, value: unknown, expiresAt: string | null): Promise<void> {
  const { error } = await createAdminClient()
    .from('kv_store')
    .upsert({ key, value, expires_at: expiresAt }, { onConflict: 'key' })
  const failure = toSupabaseError(error)
  if (failure) throw failure
}

async function supabaseDelete(key: string): Promise<void> {
  const { error } = await createAdminClient().from('kv_store').delete().eq('key', key)
  const failure = toSupabaseError(error)
  if (failure) throw failure
}

// public.kv_incr (migration 010) increments in one upsert. Until it exists the
// counter falls back to read-then-write, re-checking for the function later.
let kvIncrFunctionMissingUntil = 0

/** 42883 = undefined_function (Postgres); PGRST202 = function not in PostgREST's schema cache. */
function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === '42883' || error?.code === 'PGRST202'
}

async function supabaseIncr(key: string, ttlSeconds: number): Promise<number> {
  if (Date.now() >= kvIncrFunctionMissingUntil) {
    const { data, error } = await createAdminClient().rpc('kv_incr', {
      p_key: key,
      p_ttl_seconds: ttl(ttlSeconds),
    })
    if (!error) {
      const count = Number(data)
      if (Number.isFinite(count)) return count
      throw new SupabaseKvError('kv_incr returned a non-numeric value', false)
    }
    if (!isMissingFunction(error)) throw toSupabaseError(error)
    kvIncrFunctionMissingUntil = Date.now() + SUPABASE_MISSING_TABLE_COOLDOWN_MS
    if (!loggedFailures.has('supabase:missing_kv_incr')) {
      loggedFailures.add('supabase:missing_kv_incr')
      console.warn('[kv]', 'kv_incr function is missing (apply migration 010); counters are not atomic until then')
    }
  }

  // Read-then-write, not atomic: two concurrent increments can both read N
  // and store N+1, so a limit may let a few extra requests through. Only used
  // while migration 010 is not applied.
  const row = await supabaseGetRow(key)
  const current = row && typeof row.value === 'number' ? row.value : 0
  const next = current + 1
  const expiresAt = row?.expires_at ?? new Date(Date.now() + ttl(ttlSeconds) * 1000).toISOString()
  await supabaseUpsert(key, next, expiresAt)
  return next
}

// ─── Memory ──────────────────────────────────────────────────────────────────

interface MemoryEntry {
  // Stored as JSON so callers can't mutate cached objects by reference.
  json: string
  expiresAt: number | null
}

const memory = new Map<string, MemoryEntry>()

function memoryGet(key: string): MemoryEntry | null {
  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return entry
}

function memorySet(key: string, json: string, ttlSeconds?: number): void {
  if (memory.size >= MEMORY_MAX_ENTRIES && !memory.has(key)) {
    const now = Date.now()
    for (const [k, entry] of memory) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) memory.delete(k)
    }
    // Still full: drop the oldest insertions (Map keeps insertion order).
    while (memory.size >= MEMORY_MAX_ENTRIES) {
      const oldest = memory.keys().next().value
      if (oldest === undefined) break
      memory.delete(oldest)
    }
  }
  memory.set(key, {
    json,
    expiresAt: ttlSeconds === undefined ? null : Date.now() + ttl(ttlSeconds) * 1000,
  })
}

function parseStored<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return raw as unknown as T
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function kvGet<T>(key: string): Promise<T | null> {
  if (upstashAvailable()) {
    try {
      const [result] = await upstashPipeline([['GET', key]])
      return parseStored<T>(result)
    } catch (error) {
      backendFailed('upstash', upstashFailureType(error), error, UPSTASH_COOLDOWN_MS)
    }
  }
  if (supabaseAvailable()) {
    try {
      const row = await supabaseGetRow(key)
      return row ? (row.value as T) : null
    } catch (error) {
      supabaseFailed(error)
    }
  }
  const entry = memoryGet(key)
  return entry ? parseStored<T>(entry.json) : null
}

/** Stores a JSON-serialisable value. null/undefined delete the key. */
export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const json = value === undefined ? undefined : JSON.stringify(value)
  if (json === undefined || value === null) return kvDel(key)

  if (upstashAvailable()) {
    try {
      const command: RedisArg[] = ttlSeconds === undefined ? ['SET', key, json] : ['SET', key, json, 'EX', ttl(ttlSeconds)]
      await upstashPipeline([command])
      return
    } catch (error) {
      backendFailed('upstash', upstashFailureType(error), error, UPSTASH_COOLDOWN_MS)
    }
  }
  if (supabaseAvailable()) {
    try {
      const expiresAt = ttlSeconds === undefined ? null : new Date(Date.now() + ttl(ttlSeconds) * 1000).toISOString()
      // Round-trip through JSON so the jsonb column gets exactly what Redis would.
      await supabaseUpsert(key, JSON.parse(json), expiresAt)
      return
    } catch (error) {
      supabaseFailed(error)
    }
  }
  memorySet(key, json, ttlSeconds)
}

/**
 * Fixed-window counter: increments and returns the new value. The TTL is set
 * only when the key is created, so the window doesn't slide on every hit.
 */
export async function kvIncr(key: string, ttlSeconds: number): Promise<number> {
  if (upstashAvailable()) {
    try {
      const [count] = await upstashPipeline([
        ['INCR', key],
        ['EXPIRE', key, ttl(ttlSeconds), 'NX'],
      ])
      const n = Number(count)
      if (Number.isFinite(n)) return n
      throw new UpstashError('non-numeric INCR result')
    } catch (error) {
      backendFailed('upstash', upstashFailureType(error), error, UPSTASH_COOLDOWN_MS)
    }
  }
  if (supabaseAvailable()) {
    try {
      return await supabaseIncr(key, ttlSeconds)
    } catch (error) {
      supabaseFailed(error)
    }
  }
  const entry = memoryGet(key)
  const current = entry ? Number(JSON.parse(entry.json)) : 0
  const next = (Number.isFinite(current) ? current : 0) + 1
  if (entry) entry.json = JSON.stringify(next)
  else memorySet(key, JSON.stringify(next), ttlSeconds)
  return next
}

export async function kvDel(key: string): Promise<void> {
  // The local copy is always dropped: it may hold a value written during an outage.
  memory.delete(key)
  if (upstashAvailable()) {
    try {
      await upstashPipeline([['DEL', key]])
      return
    } catch (error) {
      backendFailed('upstash', upstashFailureType(error), error, UPSTASH_COOLDOWN_MS)
    }
  }
  if (supabaseAvailable()) {
    try {
      await supabaseDelete(key)
    } catch (error) {
      supabaseFailed(error)
    }
  }
}

/** Test hook: clears the memory store, cooldowns and the log-once memory. */
export function resetKvForTests(): void {
  memory.clear()
  loggedFailures.clear()
  disabledUntil.upstash = 0
  disabledUntil.supabase = 0
  kvIncrFunctionMissingUntil = 0
}
