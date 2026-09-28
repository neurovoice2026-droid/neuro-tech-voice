import { NextResponse, type NextRequest } from 'next/server'
import { handleRoute, noStore } from '@/lib/api/http'
import {
  isCartesiaAdminConfigured,
  isCartesiaConfigured,
  isElevenLabsConfigured,
  isGatewayConfigured,
  isOpenAIConfigured,
  isResendConfigured,
  isStripeConfigured,
  isSupabaseAdminConfigured,
  isTwilioConfigured,
  isUpstashConfigured,
  voicePipelineModeOverride,
} from '@/lib/env'
import { BREAKER_KEYS, getBreakerSnapshot, type BreakerKey, type BreakerPhase } from '@/lib/voice/breaker'
import { getCartesiaBudget } from '@/lib/voice/budget'
import { decideMode, staticModeInputs } from '@/lib/voice/mode'
import { requireCronRequest } from '../../cron/auth'

// Operational snapshot of the voice platform for on-call checks: which
// providers are configured, the Cartesia budget, breaker states and the mode a
// typical agent would get right now. Read-only (breaker probes are never
// claimed), and it carries no secrets and no customer data.

export const runtime = 'nodejs'

// A fully provisioned English agent: both provider agents synced, default voice.
const GENERIC_AGENT = {
  pipeline_mode_override: null,
  cartesia_agent_id: 'generic',
  elevenlabs_agent_id: 'generic',
  cartesia_voice_id: null,
  language: 'en',
} as const

interface BreakerView {
  key: BreakerKey
  phase: BreakerPhase | 'unknown'
  consecutive_failures?: number
  recent_events?: number
  open_until?: string | null
  reopen_count?: number
  terminal?: boolean
}

async function breakerView(key: BreakerKey): Promise<BreakerView> {
  try {
    const { phase, state } = await getBreakerSnapshot(key)
    return {
      key,
      phase,
      consecutive_failures: state.failures,
      recent_events: state.events.length,
      open_until: state.openUntil > 0 ? new Date(state.openUntil).toISOString() : null,
      reopen_count: state.reopenCount,
      terminal: state.terminal,
    }
  } catch (error) {
    console.error('[ops] breaker snapshot failed', key, error instanceof Error ? error.message : error)
    return { key, phase: 'unknown' }
  }
}

export const GET = handleRoute(async (req: NextRequest) => {
  await requireCronRequest(req, 'ops')

  const cartesiaConfigured = isCartesiaConfigured()
  const [breakers, budget] = await Promise.all([
    Promise.all(BREAKER_KEYS.map(breakerView)),
    cartesiaConfigured
      ? getCartesiaBudget({ fresh: true }).catch((error: unknown) => {
          console.error('[ops] budget lookup failed', error instanceof Error ? error.message : error)
          return null
        })
      : Promise.resolve(null),
  ])

  const phase = (key: BreakerKey) => breakers.find((b) => b.key === key)?.phase
  const inputs = staticModeInputs(GENERIC_AGENT, 'twilio')
  inputs.gatewayBreakerOpen = phase('gateway') === 'open'
  inputs.selfBreakerOpen = phase('cartesia_self') === 'open'
  inputs.managedBreakerOpen = phase('cartesia_managed') === 'open'
  inputs.creditsExhausted = budget?.credits_exhausted ?? false
  inputs.agentBudgetExhausted = budget?.agent_exhausted ?? false
  const decision = decideMode(inputs)

  return noStore(
    NextResponse.json({
      checked_at: new Date().toISOString(),
      providers: {
        cartesia: cartesiaConfigured,
        cartesia_admin: isCartesiaAdminConfigured(),
        openai: isOpenAIConfigured(),
        elevenlabs: isElevenLabsConfigured(),
        twilio: isTwilioConfigured(),
        gateway: isGatewayConfigured(),
        upstash: isUpstashConfigured(),
        supabase_admin: isSupabaseAdminConfigured(),
        stripe: isStripeConfigured(),
        resend: isResendConfigured(),
      },
      pipeline_mode_override: voicePipelineModeOverride(),
      budget: cartesiaConfigured ? (budget ?? { error: 'unavailable' }) : null,
      breakers,
      default_mode: {
        assumes: 'English agent with a default Cartesia voice, a synced Managed Agent and a standby ElevenLabs agent, phone channel',
        mode: decision.mode,
        reason: decision.reason,
        fallback: decision.fallback,
        skipped: decision.skipped,
      },
    })
  )
})
