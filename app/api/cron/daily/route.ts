import { NextResponse, type NextRequest } from 'next/server'
import { handleRoute, jsonError, noStore } from '@/lib/api/http'
import { isCartesiaConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { reconcileUnbilledCalls, reportOverageToStripe, rollUsagePeriods } from '@/lib/billing/usage'
import { runBookingReminders } from '@/lib/scheduling/reminders'
import { resyncStaleAgents } from '@/lib/voice/sync'
import { getCartesiaBudget } from '@/lib/voice/budget'
import { requireCronRequest } from '../auth'
import { purgeExpiredKv, runCronStep } from '../jobs'
import { purgeOrphanUploads } from '../storage-cleanup'

// Daily Vercel Cron (vercel.json, 07:00 UTC; Hobby allows one run a day).
// Every job is isolated: one failing never stops the others, and the JSON
// summary says what each did. A failed job answers 500 so it shows up in the
// Vercel logs; re-running the whole cron is safe because every job is idempotent.

export const runtime = 'nodejs'
export const maxDuration = 60

// Billing jobs stop starting new work at these marks (ms after the start) so
// the run always answers with its summary before maxDuration; whatever is left
// is idempotent and continues on the next run.
const RECONCILE_BUDGET_MS = 10_000
const ROLL_BUDGET_MS = 25_000
const REPORT_BUDGET_MS = 45_000
const RESYNC_BUDGET_MS = 30_000
const STORAGE_BUDGET_MS = 40_000

export const GET = handleRoute(async (req: NextRequest) => {
  await requireCronRequest(req, 'cron')
  if (!isSupabaseAdminConfigured()) {
    return jsonError(503, 'not_configured', 'SUPABASE_SERVICE_ROLE_KEY is not configured.')
  }

  const startedAt = new Date()
  const t0 = startedAt.getTime()
  // Lost bills are recorded first (they add overage), then periods roll before
  // overage is reported, so a fresh period's reset row exists first.
  const billing = (async () => {
    const reconcile = await runCronStep('reconcile_unbilled_calls', () =>
      reconcileUnbilledCalls(startedAt, { deadline: t0 + RECONCILE_BUDGET_MS })
    )
    const roll = await runCronStep('roll_usage_periods', () => rollUsagePeriods(startedAt, { deadline: t0 + ROLL_BUDGET_MS }))
    const report = await runCronStep('report_overage', () =>
      reportOverageToStripe(startedAt, { deadline: t0 + REPORT_BUDGET_MS })
    )
    return [reconcile, roll, report] as const
  })()

  const [[reconcileCalls, rollPeriods, reportOverage], bookingReminders, resyncAgents, purgeKv, purgeUploads, warmBudget] = await Promise.all([
    billing,
    runCronStep('booking_reminders', () => runBookingReminders(startedAt)),
    runCronStep('resync_stale_agents', () => resyncStaleAgents({ deadline: t0 + RESYNC_BUDGET_MS })),
    runCronStep('purge_expired_kv', () => purgeExpiredKv(startedAt)),
    runCronStep('purge_orphan_uploads', () => purgeOrphanUploads(startedAt, { deadline: t0 + STORAGE_BUDGET_MS })),
    runCronStep('warm_cartesia_budget', async () => {
      if (!isCartesiaConfigured()) return { skipped: 'not_configured' }
      const budget = await getCartesiaBudget({ fresh: true })
      return {
        cycle_key: budget.cycle_key,
        credits_remaining: budget.credits_remaining,
        credits_exhausted: budget.credits_exhausted,
        agent_cents_remaining: budget.agent_cents_remaining,
        agent_exhausted: budget.agent_exhausted,
      }
    }),
  ])

  const steps = {
    reconcile_unbilled_calls: reconcileCalls,
    roll_usage_periods: rollPeriods,
    report_overage: reportOverage,
    booking_reminders: bookingReminders,
    resync_stale_agents: resyncAgents,
    purge_expired_kv: purgeKv,
    purge_orphan_uploads: purgeUploads,
    warm_cartesia_budget: warmBudget,
  }
  const ok = Object.values(steps).every((step) => step.ok)
  if (!ok) console.error('[cron] daily run finished with failures')

  return noStore(
    NextResponse.json(
      { ok, started_at: startedAt.toISOString(), duration_ms: Date.now() - startedAt.getTime(), steps },
      { status: ok ? 200 : 500 }
    )
  )
})
