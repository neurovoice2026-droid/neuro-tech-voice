import 'server-only'
// Everything the router needs to decide one call, loaded with the service
// role (Twilio webhooks carry no user session) and always scoped by the
// phone number Twilio called or by our own call id.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekProvider } from '@/lib/voice-providers/circuit-registry'
import { forcedProvider, platformFallbackEnabled, cartesiaSip } from '@/lib/voice-providers/config'
import { isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import { isConfigured as ctConfigured } from '@/lib/cartesia/client'
import { readAfterHours, readConversationSettings, readTransferSettings, readWorkingHours } from '@/lib/voice-providers/settings'
import { evaluateWorkingHours } from '@/lib/voice-providers/working-hours'
import type { RoutingInput } from '@/lib/voice-providers/routing'
import type { VoiceProvider } from '@/lib/voice-providers/errors'
import { normalizeAgentLanguage } from '@/lib/voice/languages'

export interface NumberRow {
  id: string
  org_id: string
  agent_id: string | null
  number: string
  is_active: boolean
  routing_mode: 'app_routed' | 'native_elevenlabs'
  supports_inbound: boolean
  supports_outbound: boolean
  cartesia_phone_number_id: string | null
}

export interface RoutingContext {
  db: SupabaseClient
  number: NumberRow
  org: { id: string; name: string | null; timezone: string; voice_fallback_enabled: boolean }
  agent: {
    id: string
    name: string
    is_active: boolean
    language: string
    primary: VoiceProvider
    fallback: VoiceProvider | null
    maxDurationSeconds: number
    transferNumber: string | null
    transferEnabled: boolean
  } | null
  externalIds: Partial<Record<VoiceProvider, string>>
  routingInput: RoutingInput | null
}

const NUMBER_COLUMNS = 'id, org_id, agent_id, number, is_active, routing_mode, supports_inbound, supports_outbound, cartesia_phone_number_id'

export async function findNumber(db: SupabaseClient, e164: string): Promise<NumberRow | null> {
  const { data, error } = await db.from('phone_numbers').select(NUMBER_COLUMNS).eq('number', e164).maybeSingle()
  if (error) throw new Error(`phone_numbers lookup failed: ${error.message}`)
  return (data as NumberRow | null) ?? null
}

export async function numberById(db: SupabaseClient, id: string): Promise<NumberRow | null> {
  const { data, error } = await db.from('phone_numbers').select(NUMBER_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`phone_numbers lookup failed: ${error.message}`)
  return (data as NumberRow | null) ?? null
}

export async function loadRoutingContext(number: NumberRow, now = new Date()): Promise<RoutingContext> {
  const db = createAdminClient()
  const agentQuery = number.agent_id
    ? db.from('agents').select('*').eq('id', number.agent_id).eq('org_id', number.org_id).maybeSingle()
    : db.from('agents').select('*').eq('org_id', number.org_id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  const [{ data: org, error: orgErr }, { data: agentRow, error: agentErr }] = await Promise.all([
    db.from('organizations').select('id, name, timezone, voice_fallback_enabled').eq('id', number.org_id).single(),
    agentQuery,
  ])
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)

  const orgCtx = {
    id: org.id as string,
    name: (org.name as string | null) ?? null,
    timezone: (org.timezone as string) ?? 'UTC',
    voice_fallback_enabled: org.voice_fallback_enabled !== false,
  }
  if (!agentRow) return { db, number, org: orgCtx, agent: null, externalIds: {}, routingInput: null }

  const { data: resources, error: resErr } = await db
    .from('agent_provider_resources')
    .select('provider, external_id')
    .eq('agent_id', agentRow.id)
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  const externalIds: Partial<Record<VoiceProvider, string>> = {}
  for (const r of resources ?? []) if (r.external_id) externalIds[r.provider as VoiceProvider] = r.external_id as string
  if (!externalIds.elevenlabs && agentRow.elevenlabs_agent_id) externalIds.elevenlabs = agentRow.elevenlabs_agent_id as string

  const conversation = readConversationSettings(agentRow.conversation_settings ?? (agentRow.metadata as Record<string, unknown> | null)?.behavior_settings)
  const transfer = readTransferSettings(agentRow.transfer_settings)
  const afterHours = readAfterHours(agentRow.after_hours)
  const hours = evaluateWorkingHours(readWorkingHours(agentRow.working_hours), orgCtx.timezone, afterHours, now)
  const [elCircuit, ctCircuit] = await Promise.all([peekProvider('elevenlabs'), peekProvider('cartesia')])
  const sip = cartesiaSip()

  const agent = {
    id: agentRow.id as string,
    name: agentRow.name as string,
    is_active: !!agentRow.is_active,
    language: normalizeAgentLanguage(agentRow.language as string | null),
    primary: ((agentRow.primary_provider as VoiceProvider) ?? 'elevenlabs'),
    fallback: (agentRow.fallback_provider as VoiceProvider | null) ?? null,
    maxDurationSeconds: conversation.max_call_duration_minutes * 60,
    transferNumber: transfer.enabled ? transfer.number : null,
    transferEnabled: transfer.enabled && !!transfer.number,
  }

  const routingInput: RoutingInput = {
    agentActive: agent.is_active,
    numberActive: number.is_active,
    primary: agent.primary,
    fallback: agent.fallback,
    fallbackEnabled: platformFallbackEnabled() && orgCtx.voice_fallback_enabled,
    force: forcedProvider(),
    providers: {
      elevenlabs: { configured: elConfigured(), hasResource: !!externalIds.elevenlabs, circuit: elCircuit },
      cartesia: {
        configured: ctConfigured() && !!sip.username && !!sip.password,
        // The SIP route needs both the fallback agent and the number imported for it.
        hasResource: !!externalIds.cartesia && !!number.cartesia_phone_number_id,
        circuit: ctCircuit,
      },
    },
    hours,
    afterHours,
  }
  return { db, number, org: orgCtx, agent, externalIds, routingInput }
}
