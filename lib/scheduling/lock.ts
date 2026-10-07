import 'server-only'
// A short per-organisation lease (booking_locks, migration 018) that
// serializes "check the calendar, then write the booking" across serverless
// instances, so two callers can never be given the same time. Same pattern
// as the platform resource leases (insert-if-absent, or take over an expired
// lease); the unique index bookings_active_slot is the last line of defence.

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'

/** Covers a busy check, the insert, a slow calendar write and the event lookup after it. */
export const LOCK_TTL_MS = 30_000
const LOCK_ATTEMPTS = 8
const LOCK_WAIT_MS = 350

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function claim(db: SupabaseClient, orgId: string, owner: string, now: number): Promise<boolean> {
  const until = new Date(now + LOCK_TTL_MS).toISOString()
  const { data, error } = await db
    .from('booking_locks')
    .upsert({ org_id: orgId, lock_owner: owner, lock_until: until }, { onConflict: 'org_id', ignoreDuplicates: true })
    .select('org_id')
  if (error) throw new Error(`booking lock insert failed: ${error.message}`)
  if (data && data.length > 0) return true
  // An expired lease belongs to a crashed writer: take it over.
  const { data: took, error: takeErr } = await db
    .from('booking_locks')
    .update({ lock_owner: owner, lock_until: until })
    .eq('org_id', orgId)
    .lt('lock_until', new Date(now).toISOString())
    .select('org_id')
  if (takeErr) throw new Error(`booking lock takeover failed: ${takeErr.message}`)
  return !!took && took.length > 0
}

/**
 * Runs `run` while holding the org's booking lease. 'locked' when another
 * booking held it for every attempt (about 3 s) or the caller's deadline
 * passed. A lock-store failure throws (the booking is not attempted).
 */
export async function withOrgBookingLock<T>(
  db: SupabaseClient,
  orgId: string,
  log: Logger,
  run: () => Promise<T>,
  signal?: AbortSignal,
  opts: { attempts?: number; waitMs?: number } = {},
): Promise<T | 'locked'> {
  const owner = randomUUID()
  const attempts = opts.attempts ?? LOCK_ATTEMPTS
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) return 'locked'
    if (await claim(db, orgId, owner, Date.now())) {
      try {
        return await run()
      } finally {
        const { error } = await db.from('booking_locks').delete().eq('org_id', orgId).eq('lock_owner', owner)
        if (error) log.error('booking.lock_release_failed', error, { orgId })
      }
    }
    if (attempt < attempts - 1) await sleep(opts.waitMs ?? LOCK_WAIT_MS)
  }
  return 'locked'
}
