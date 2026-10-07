import 'server-only'
// Booking tools are attached only while Google Calendar is connected: when
// the connection changes (OAuth callback, disconnect), the org's agent is
// re-synced in the background so the tools (and the prompt) follow at once
// instead of at the next config rollout. Only when booking is enabled;
// failures are logged, never thrown (the rollout catches up anyway).

import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { readBookingSettings } from '@/lib/voice-providers/settings'

export async function resyncAfterCalendarChange(orgId: string, log: Logger): Promise<number> {
  const db = createAdminClient()
  const { data, error } = await db.from('agents').select('id, booking_settings').eq('org_id', orgId).limit(5)
  if (error) {
    // 42703: migration 018 not applied yet, nothing can use booking.
    if (error.code !== '42703') log.error('calendar_resync.agents_read_failed', error, { orgId })
    return 0
  }
  const agents = (data ?? []).filter((a) => readBookingSettings(a.booking_settings).enabled)
  if (!agents.length) return 0
  const { bumpRevision, syncAgent } = await import('@/lib/voice-providers/agent-sync')
  let synced = 0
  for (const a of agents) {
    try {
      await bumpRevision(String(a.id))
      await syncAgent(String(a.id), { log })
      synced++
    } catch (err) {
      log.error('calendar_resync.sync_failed', err, { orgId, agentId: a.id })
    }
  }
  return synced
}

/** Fire-and-forget after the response (OAuth callback / disconnect routes). */
export function scheduleCalendarResync(orgId: string, log: Logger): void {
  deferBackground(
    resyncAfterCalendarChange(orgId, log).catch((err: unknown) => {
      log.error('calendar_resync.failed', err, { orgId })
    }),
  )
}
