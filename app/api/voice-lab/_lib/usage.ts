import 'server-only'
import { ApiError } from '@/lib/api/http'
import type { OrgContext } from '@/lib/api/auth'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { quotaState, sumQuantities, toolUsagePeriod, type QuotaState, type UsagePeriod } from './quota'

// Voice Lab usage, read from provider_usage_events (kind tts_tool: characters;
// stt_tool: seconds). That table has no policies for signed-in users, so the
// service-role client reads it with an explicit org filter.

export type ToolKind = 'tts_tool' | 'stt_tool'

const PAGE_SIZE = 1000
const MAX_PAGES = 20
const DB_TIMEOUT_MS = 5000

export interface ToolQuota {
  kind: ToolKind
  period: UsagePeriod
  state: QuotaState
}

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function usedThisPeriod(orgId: string, kind: ToolKind, period: UsagePeriod): Promise<number> {
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Usage tracking isn’t configured on this server, so the Voice Lab is unavailable.')
  }
  const db = createAdminClient()
  const rows: { quantity: number | string | null }[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await db
      .from('provider_usage_events')
      .select('id, quantity')
      .eq('org_id', orgId)
      .eq('kind', kind)
      .gte('created_at', period.start.toISOString())
      .lt('created_at', period.end.toISOString())
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS))
    if (error) {
      if (isMissingTable(error)) {
        throw new ApiError(503, 'not_configured', 'The Voice Lab needs a database update before it can be used. Please contact support.')
      }
      console.error('[voice-lab] reading usage failed', error.code, error.message)
      throw new ApiError(500, 'internal_error', 'We couldn’t check your Voice Lab allowance. Please try again.')
    }
    const batch = (data ?? []) as { quantity: number | string | null }[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return sumQuantities(rows)
}

export async function getToolQuota(ctx: OrgContext, kind: ToolKind, now: Date = new Date()): Promise<ToolQuota> {
  const entitlements = entitlementsFor(ctx.org.plan)
  const limit = kind === 'tts_tool' ? entitlements.ttsCharactersPerMonth : entitlements.sttSecondsPerMonth
  const period = toolUsagePeriod(ctx.org, now)
  const used = await usedThisPeriod(ctx.org.id, kind, period)
  return { kind, period, state: quotaState(limit, used) }
}

export function formatResetDate(period: UsagePeriod): string {
  return period.end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}
