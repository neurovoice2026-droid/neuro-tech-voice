import 'server-only'
import { ApiError } from '@/lib/api/http'
import { isTrialExpired } from '@/lib/billing/entitlements'
import { releaseLock, tryAcquireLock } from '@/lib/knowledge/lock'
import type { Organization } from '@/types'
import type { ToolKind } from './usage'

// The Voice Lab allowance is read before the provider call and charged after
// it, so requests fired in parallel would all pass the check against the same
// total and together use many times the allowance. One job per organisation
// and tool at a time closes that race: the charge of one job is recorded
// before the next one can check.

/** How long a slot stays taken if the function dies before releasing it (longer than maxDuration). */
export const TOOL_SLOT_TTL_SECONDS: Record<ToolKind, number> = { tts_tool: 70, stt_tool: 130 }

export function toolSlotKey(orgId: string, kind: ToolKind): string {
  return `voice-lab:inflight:${kind}:${orgId}`
}

/** Takes the organisation's slot for this tool, or throws 429 while another job holds it. Returns the release function. */
export async function acquireToolSlot(orgId: string, kind: ToolKind): Promise<() => Promise<void>> {
  const key = toolSlotKey(orgId, kind)
  if (!(await tryAcquireLock(key, TOOL_SLOT_TTL_SECONDS[kind]))) {
    throw new ApiError(
      429,
      'tool_busy',
      kind === 'stt_tool'
        ? 'Another transcription is still running. Wait for it to finish, then try again.'
        : 'Another clip is still being generated. Wait for it to finish, then try again.',
      { 'Retry-After': '5' }
    )
  }
  let released = false
  return async () => {
    if (released) return
    released = true
    await releaseLock(key).catch((error: unknown) => console.warn('[voice-lab] releasing the tool slot failed', error instanceof Error ? error.message : error))
  }
}

/** The Voice Lab spends provider credits: it ends with the trial. */
export function requireActiveTrial(org: Pick<Organization, 'plan' | 'trial_ends_at'>): void {
  if (isTrialExpired(org)) {
    throw new ApiError(403, 'trial_expired', 'Your trial has ended. Choose a plan to keep using the Voice Lab.')
  }
}
