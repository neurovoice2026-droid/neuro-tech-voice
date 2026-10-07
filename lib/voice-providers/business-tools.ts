import 'server-only'
// In-call business tools on the agent (slice B2): which ones an agent should
// carry (its booking/message settings and the org's Google Calendar
// connection), and, for the ElevenLabs agent, the platform tool ids to
// attach. A tool that cannot be obtained is never swallowed: it is left out,
// the prompt stops promising it (booking falls back to taking a message), and
// the sync is reported degraded so it is retried.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import type { PlatformToolKey } from '@/lib/elevenlabs/tools/definitions'
import { readBookingSettings, readMessageSettings } from './settings'
import { composeSystemPrompt } from './prompt'
import type { BookingPromptMode } from './prompt-business'
import type { AgentSpec, BusinessToolsSpec } from './types'
import { ensurePlatformTool, invalidatePlatformToolMemo, storedPlatformToolId } from './platform-tools'

export const NO_BUSINESS_TOOLS: BusinessToolsSpec = { bookingEnabled: false, booking: false, takeMessage: false }

export const BOOKING_TOOL_KEYS: readonly PlatformToolKey[] = ['elevenlabs.tool.check_availability', 'elevenlabs.tool.book_appointment']
export const MESSAGE_TOOL_KEY: PlatformToolKey = 'elevenlabs.tool.take_message'

/**
 * Recorded on an agent sync that could not obtain a business tool
 * (agent_provider_resources.status 'degraded'). Tenant-safe wording.
 */
export const BUSINESS_TOOLS_DEGRADED = {
  code: 'business_tools_unavailable',
  message: 'Appointment booking or message taking is unavailable during calls right now: your agent takes messages by voice instead. This is retried automatically.',
} as const

function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
}

/**
 * The business tools an agent should carry. Booking needs the setting AND an
 * active Google Calendar connection (refresh token present). Columns missing
 * (migration 018 not applied) read as everything off.
 */
export async function loadBusinessTools(db: SupabaseClient, agent: { id: string; org_id: string }, log?: Logger): Promise<BusinessToolsSpec> {
  const [settings, calendar] = await Promise.all([
    db.from('agents').select('booking_settings, message_settings').eq('id', agent.id).eq('org_id', agent.org_id).maybeSingle(),
    db.from('integrations').select('is_active, google_refresh_token').eq('org_id', agent.org_id).eq('type', 'google_calendar').maybeSingle(),
  ])
  if (settings.error) {
    if (settings.error.code === '42703') {
      log?.warn('business_tools.migration_missing', { agentId: agent.id })
      return { ...NO_BUSINESS_TOOLS }
    }
    throw new Error(`agents business tool settings read failed: ${settings.error.message}`)
  }
  if (calendar.error) throw new Error(`integrations read failed: ${calendar.error.message}`)
  const booking = readBookingSettings(settings.data?.booking_settings)
  const messages = readMessageSettings(settings.data?.message_settings)
  const connected = !!calendar.data?.is_active && typeof calendar.data.google_refresh_token === 'string' && calendar.data.google_refresh_token.length > 0
  return {
    bookingEnabled: booking.enabled,
    booking: booking.enabled && connected && googleConfigured(),
    takeMessage: messages.enabled,
  }
}

export interface BusinessToolAttachment {
  /** Platform tool ids for prompt.tool_ids, in a stable order. */
  ids: string[]
  booking: boolean
  takeMessage: boolean
  degraded: typeof BUSINESS_TOOLS_DEGRADED | null
}

/**
 * The ElevenLabs platform tool ids for the spec. 'write' obtains them
 * (reconciled, created on first use); 'hash' only reads the stored ids and
 * never creates anything. A paused agent carries none.
 */
export async function resolveBusinessToolIds(spec: AgentSpec, mode: 'write' | 'hash', log: Logger): Promise<BusinessToolAttachment> {
  const want = spec.active ? spec.businessTools : undefined
  const out: BusinessToolAttachment = { ids: [], booking: false, takeMessage: false, degraded: null }
  if (!want || (!want.booking && !want.takeMessage)) return out
  const obtain = async (key: PlatformToolKey): Promise<string | null> => {
    if (mode === 'hash') return storedPlatformToolId(key)
    try {
      return (await ensurePlatformTool(key, { verify: 'cached' })).toolId
    } catch (err) {
      log.error('agent_sync.business_tool_unavailable', err, { key, orgId: spec.orgId, agentId: spec.localAgentId })
      out.degraded = BUSINESS_TOOLS_DEGRADED
      return null
    }
  }
  if (want.booking) {
    const ids = await Promise.all(BOOKING_TOOL_KEYS.map(obtain))
    // Both or neither: availability without booking (or the reverse) would mislead the caller.
    if (ids.every((id): id is string => !!id)) {
      out.ids.push(...ids)
      out.booking = true
    }
  }
  if (want.takeMessage) {
    const id = await obtain(MESSAGE_TOOL_KEY)
    if (id) {
      out.ids.push(id)
      out.takeMessage = true
    }
  }
  return out
}

/**
 * The spec whose prompt matches the tools actually attached: booking that
 * could not be attached falls back to taking the request as a message, and a
 * missing take_message tool is never promised.
 */
export function withAttachedBusinessTools(spec: AgentSpec, attached: Pick<BusinessToolAttachment, 'booking' | 'takeMessage'>): AgentSpec {
  const want = spec.businessTools
  if (!want || !spec.promptInput) return spec
  const bookingMode: BookingPromptMode | null = want.booking && attached.booking ? 'tools' : want.bookingEnabled ? 'take_message' : null
  const takeMessageTool = want.takeMessage && attached.takeMessage
  if ((spec.promptInput.bookingMode ?? null) === bookingMode && !!spec.promptInput.takeMessageTool === takeMessageTool) return spec
  const promptInput = { ...spec.promptInput, bookingMode, takeMessageTool }
  return { ...spec, promptInput, systemPrompt: composeSystemPrompt(promptInput) }
}

/** An agent write that referenced the business tools failed: re-verify them next time (a tool may have been deleted). */
export function invalidateBusinessToolMemo(): void {
  for (const key of [...BOOKING_TOOL_KEYS, MESSAGE_TOOL_KEY]) invalidatePlatformToolMemo(key)
}
