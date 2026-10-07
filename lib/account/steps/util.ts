import 'server-only'
// Small helpers shared by the deletion steps.

import { isProviderError } from '@/lib/voice-providers/errors'

/** A provider, Twilio or Stripe "does not exist" answer: the resource is already gone. */
export function isGone(err: unknown): boolean {
  if (isProviderError(err)) return err.code === 'not_found'
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown } | null
  if (!e || typeof e !== 'object') return false
  return e.status === 404 || e.statusCode === 404 || e.code === 'resource_missing' || e.code === 20404
}

/** The provider key is missing in this deployment: nothing can be deleted there. */
export function isNotConfigured(err: unknown): boolean {
  return isProviderError(err) && err.code === 'not_configured'
}

/** Runs `fn` over `items`, `concurrency` at a time; no new item starts after `deadline`. */
export async function forEachLimited<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  deadline: number,
  now: () => number = Date.now,
): Promise<{ started: number }> {
  let index = 0
  let started = 0
  const worker = async () => {
    while (index < items.length) {
      if (now() >= deadline) return
      const item = items[index++]
      started++
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker))
  return { started }
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Head count of rows matching the query (PostgREST count=exact). */
export async function countOf(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string): Promise<number> {
  const { count, error } = await query
  if (error) throw new Error(`${what} count failed: ${error.message}`)
  return count ?? 0
}
