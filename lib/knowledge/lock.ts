import 'server-only'
import { kvDel, kvIncr } from '@/lib/kv'

// Best-effort mutual exclusion on top of the KV counter: the first kvIncr in a
// window gets 1 and owns the lock; the owner deletes the key when done and the
// TTL frees it if the function dies. Shared across instances with Upstash or
// the Supabase kv_store; per instance with the in-memory fallback.

export async function tryAcquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  return (await kvIncr(key, ttlSeconds)) === 1
}

export async function releaseLock(key: string): Promise<void> {
  await kvDel(key)
}

/** Runs fn while holding the lock, waiting up to waitMs for it. Runs anyway after the wait (logged). */
export async function withLock<T>(
  key: string,
  opts: { ttlSeconds: number; waitMs: number },
  fn: () => Promise<T>
): Promise<T> {
  const deadline = Date.now() + opts.waitMs
  let acquired = await tryAcquireLock(key, opts.ttlSeconds)
  while (!acquired && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    acquired = await tryAcquireLock(key, opts.ttlSeconds)
  }
  if (!acquired) console.warn('[knowledge] lock wait timed out; continuing without it', key)
  try {
    return await fn()
  } finally {
    if (acquired) await releaseLock(key)
  }
}

export function ingestLockKey(documentId: string): string {
  return `kb:ingest:${documentId}`
}
