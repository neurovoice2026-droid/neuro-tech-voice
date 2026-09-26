import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Agent, Organization, ServiceOffering } from '@/types'
import { isGoogleConfigured, isTwilioConfigured } from '@/lib/env'
import {
  computeCapabilities,
  parseServices,
  summarizeContacts,
  type ContactSummaryRow,
} from '@/lib/voice/session-loader'
import type { ToolCapabilities } from '@/lib/voice/tools/definitions'
import { isMissingRelationError } from '@/lib/voice/sync/db'

// What a provider agent needs besides the agent row: which tools are really
// usable for the org, the services to mention and the team list. The rules
// and wording come from the session loader (S1), so a Managed Agent or the
// ElevenLabs standby is briefed exactly like a self-run phone call; this
// module only gathers the facts, in bulk, from stored rows.
//
// Every query filters by org or agent explicitly: this runs with the service
// role. Tables added by migration 010 may not exist yet; a missing table means
// the feature isn't set up, while any other failure is thrown so a sync never
// strips tools from a live agent because of a transient database error.

export { isMissingRelationError }

export type SyncOrg = Pick<Organization, 'id' | 'name' | 'timezone' | 'plan' | 'sms_enabled' | 'onboarding_completed'>

export interface AgentSyncContext {
  capabilities: ToolCapabilities
  services: ServiceOffering[]
  contactsSummary: string | null
  /** ElevenLabs twin of the agent's cloned Cartesia voice, when one exists. */
  elevenLabsTwinVoiceId?: string | null
}

export interface CapabilityFacts {
  hasCalendarIntegration: boolean
  hasSchedulingSettings: boolean
  hasReadyKnowledge: boolean
  hasSmsNumber: boolean
  hasTransferContact: boolean
}

/** Same as the session loader's contact query limit. */
const MAX_CONTACTS = 25

/**
 * PostgREST caps a response at 1,000 rows (Supabase's default max-rows). The
 * daily resync loads facts for up to 200 agents at once, so each bulk query is
 * read in ordered pages; a silently cut list would hide a knowledge base or a
 * team member and make an up-to-date agent look stale.
 */
const PAGE_ROWS = 1000
const MAX_ROWS = 50_000

/** Tool switches for a provider agent, which always serves phone calls. */
export function capabilitiesFor(
  agent: Pick<Agent, 'lead_fields'>,
  org: Pick<SyncOrg, 'plan' | 'sms_enabled'>,
  facts: CapabilityFacts
): ToolCapabilities {
  return computeCapabilities({
    channel: 'twilio',
    plan: org.plan,
    smsEnabled: org.sms_enabled !== false,
    twilioConfigured: isTwilioConfigured(),
    googleConfigured: isGoogleConfigured(),
    calendarIntegrationActive: facts.hasCalendarIntegration,
    schedulingSettingsExist: facts.hasSchedulingSettings,
    knowledgeReady: facts.hasReadyKnowledge,
    hasSmsCapableNumber: facts.hasSmsNumber,
    hasTransferContact: facts.hasTransferContact,
    leadFieldCount: Array.isArray(agent.lead_fields) ? agent.lead_fields.length : 0,
  })
}

type RowsPage = PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

/** Every row of an ordered query, page by page. `page(from, to)` must apply `.range(from, to)`. */
async function optionalRows<T>(label: string, page: (from: number, to: number) => RowsPage): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1)
    if (error) {
      if (isMissingRelationError(error)) return []
      console.error('[agent-sync]', `${label} lookup failed`, error.code, error.message)
      throw new Error(`${label} lookup failed`)
    }
    const batch = (Array.isArray(data) ? data : []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE_ROWS) return rows
    if (rows.length >= MAX_ROWS) {
      // Failing is safer than briefing agents from a partial list.
      console.error('[agent-sync]', `${label} lookup returned more than ${MAX_ROWS} rows`)
      throw new Error(`${label} lookup too large`)
    }
  }
}

type ContactRow = ContactSummaryRow & { org_id: string }

/** Contexts for many agents with six queries in total (the daily resync walks every agent). */
export async function loadSyncContexts(
  admin: SupabaseClient,
  entries: { agent: Agent; org: SyncOrg }[]
): Promise<Map<string, AgentSyncContext>> {
  const result = new Map<string, AgentSyncContext>()
  if (entries.length === 0) return result
  const orgIds = [...new Set(entries.map((e) => e.org.id))]
  const agentIds = entries.map((e) => e.agent.id)

  const [calendars, documents, numbers, contacts, scheduling, twins] = await Promise.all([
    optionalRows<{ org_id: string }>('calendar integration', (from, to) =>
      admin
        .from('integrations')
        .select('org_id')
        .in('org_id', orgIds)
        .eq('type', 'google_calendar')
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    optionalRows<{ agent_id: string }>('knowledge', (from, to) =>
      admin
        .from('knowledge_documents')
        .select('agent_id')
        .in('agent_id', agentIds)
        .eq('status', 'ready')
        .gt('chunk_count', 0)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    optionalRows<{ org_id: string }>('sms number', (from, to) =>
      admin
        .from('phone_numbers')
        .select('org_id')
        .in('org_id', orgIds)
        .eq('sms_capable', true)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    optionalRows<ContactRow>('team contacts', (from, to) =>
      admin
        .from('escalation_contacts')
        .select('org_id, name, role, phone, transfer_enabled, is_on_call, conditions, sort_order')
        .in('org_id', orgIds)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    optionalRows<{ org_id: string; services: unknown }>('scheduling settings', (from, to) =>
      admin.from('scheduling_settings').select('org_id, services').in('org_id', orgIds).order('org_id', { ascending: true }).range(from, to)
    ),
    optionalRows<{ org_id: string; cartesia_voice_id: string; elevenlabs_voice_id: string | null }>('voice clone twins', (from, to) =>
      admin
        .from('voice_clones')
        .select('org_id, cartesia_voice_id, elevenlabs_voice_id')
        .in('org_id', orgIds)
        .eq('status', 'ready')
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ])

  const calendarOrgs = new Set(calendars.map((r) => r.org_id))
  const knowledgeAgents = new Set(documents.map((r) => r.agent_id))
  const smsOrgs = new Set(numbers.map((r) => r.org_id))
  const contactsByOrg = new Map<string, ContactRow[]>()
  for (const contact of contacts) {
    const list = contactsByOrg.get(contact.org_id) ?? []
    if (list.length < MAX_CONTACTS) list.push(contact)
    contactsByOrg.set(contact.org_id, list)
  }
  const schedulingByOrg = new Map(scheduling.map((row) => [row.org_id, row]))
  const twinByVoice = new Map(
    twins.filter((row) => row.elevenlabs_voice_id).map((row) => [`${row.org_id}:${row.cartesia_voice_id}`, row.elevenlabs_voice_id])
  )

  for (const { agent, org } of entries) {
    const orgContacts = contactsByOrg.get(org.id) ?? []
    const settings = schedulingByOrg.get(org.id)
    const capabilities = capabilitiesFor(agent, org, {
      hasCalendarIntegration: calendarOrgs.has(org.id),
      hasSchedulingSettings: !!settings,
      hasReadyKnowledge: knowledgeAgents.has(agent.id),
      hasSmsNumber: smsOrgs.has(org.id),
      hasTransferContact: orgContacts.some((c) => c.transfer_enabled && !!c.phone),
    })
    result.set(agent.id, {
      capabilities,
      services: parseServices(settings?.services),
      contactsSummary: summarizeContacts(orgContacts, { transfersAvailable: capabilities.transfer }),
      elevenLabsTwinVoiceId: agent.cartesia_voice_id ? twinByVoice.get(`${org.id}:${agent.cartesia_voice_id}`) ?? null : null,
    })
  }
  return result
}
