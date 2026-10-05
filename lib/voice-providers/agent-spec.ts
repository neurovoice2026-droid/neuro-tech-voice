import 'server-only'
// Loads everything a provider needs about one local agent and turns it into a
// provider-neutral AgentSpec. The ElevenLabs and Cartesia agents are both
// built from this, which is what keeps primary and fallback consistent.

import type { SupabaseClient } from '@supabase/supabase-js'
import { composeSystemPrompt } from './prompt'
import {
  readAnalysisSettings,
  readConversationSettings,
  readDynamicVariables,
  readPrivacySettings,
  readTransferSettings,
  readVoiceTuning,
} from './settings'
import type { AgentSpec } from './types'
import { safeTimeZone } from '@/lib/scheduling/time'
import { applyDisclosure } from '@/lib/voice/greetings'
import { normalizeAgentLanguage } from '@/lib/voice/languages'

export interface AgentRow {
  id: string
  org_id: string
  name: string
  language: string | null
  system_prompt: string | null
  first_message: string | null
  fallback_message: string | null
  voice_id: string | null
  fallback_voice_id: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  conversation_settings: unknown
  transfer_settings: unknown
  analysis_settings: unknown
  privacy_settings: unknown
  voice_settings: unknown
  dynamic_variables: unknown
  after_hours: unknown
  working_hours: unknown
  config_revision: number
  primary_provider: 'elevenlabs' | 'cartesia'
  fallback_provider: 'elevenlabs' | 'cartesia' | null
}

export const AGENT_COLUMNS =
  'id, org_id, name, language, system_prompt, first_message, fallback_message, voice_id, fallback_voice_id, is_active, metadata, conversation_settings, transfer_settings, analysis_settings, privacy_settings, voice_settings, dynamic_variables, after_hours, working_hours, config_revision, primary_provider, fallback_provider'

const MAX_APPENDIX_CHARS = 24_000
const MAX_EXCERPT_PER_DOC = 8_000

export async function loadAgentRow(db: SupabaseClient, agentId: string): Promise<AgentRow | null> {
  const { data, error } = await db.from('agents').select(AGENT_COLUMNS).eq('id', agentId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return (data as AgentRow | null) ?? null
}

export async function buildAgentSpec(db: SupabaseClient, agent: AgentRow): Promise<AgentSpec> {
  const [{ data: org, error: orgErr }, { data: docs, error: docErr }, { data: numbers, error: numErr }] = await Promise.all([
    db.from('organizations').select('id, name, timezone').eq('id', agent.org_id).single(),
    db
      .from('knowledge_documents')
      .select('id, name, type, elevenlabs_doc_id, cartesia_doc_id, status, content_excerpt')
      .eq('agent_id', agent.id)
      .eq('org_id', agent.org_id)
      .in('status', ['ready', 'processing'])
      .order('created_at', { ascending: true }),
    db.from('phone_numbers').select('routing_mode').eq('org_id', agent.org_id),
  ])
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
  if (docErr) throw new Error(`knowledge_documents read failed: ${docErr.message}`)
  if (numErr) throw new Error(`phone_numbers read failed: ${numErr.message}`)

  const language = normalizeAgentLanguage(agent.language)
  const conversation = readConversationSettings(agent.conversation_settings ?? agent.metadata?.behavior_settings)
  const transfer = readTransferSettings(agent.transfer_settings)
  const privacy = readPrivacySettings(agent.privacy_settings, (agent.metadata?.behavior_settings as Record<string, unknown> | undefined)?.record_calls)
  const timezone = safeTimeZone(org?.timezone as string | null)
  const orgName = (org?.name as string | null) ?? null

  // New orgs (no number yet) default to app routing, the only mode with failover.
  const modes = (numbers ?? []).map((n) => n.routing_mode as string)
  const appRouted = modes.length === 0 || modes.some((m) => m === 'app_routed')

  const promptBase = {
    system_prompt: agent.system_prompt,
    language,
    fallback_message: agent.fallback_message,
    businessName: orgName,
    timezone,
    transferEnabled: transfer.enabled && !!transfer.number,
    transferLabel: transfer.label,
    endCallEnabled: conversation.allow_end_call,
  }
  const cartesiaToolAvailable = (process.env.CARTESIA_TOOL_SECRET ?? '').trim().length >= 24

  // The first thing a caller hears always discloses the AI (and recording,
  // when enabled), whatever the customer typed. Idempotent.
  const firstMessage = applyDisclosure(agent.first_message, {
    language,
    businessName: orgName ?? '',
    recordingNotice: conversation.recording_notice,
  })

  const knowledge = (docs ?? [])
    .filter((d) => d.status === 'ready' || d.elevenlabs_doc_id)
    .map((d) => ({
      name: String(d.name),
      type: (d.type === 'url' ? 'url' : d.type === 'text' ? 'text' : 'file') as 'file' | 'url' | 'text',
      elevenlabsId: (d.elevenlabs_doc_id as string | null) ?? null,
      cartesiaId: (d.cartesia_doc_id as string | null) ?? null,
    }))

  let appendix = ''
  for (const d of docs ?? []) {
    const excerpt = typeof d.content_excerpt === 'string' ? d.content_excerpt.slice(0, MAX_EXCERPT_PER_DOC) : ''
    if (!excerpt) continue
    const block = `### ${String(d.name).slice(0, 120)}\n${excerpt}\n`
    if (appendix.length + block.length > MAX_APPENDIX_CHARS) break
    appendix += block
  }

  return {
    localAgentId: agent.id,
    orgId: agent.org_id,
    orgName,
    name: agent.name,
    language,
    systemPrompt: composeSystemPrompt({ ...promptBase, callContext: 'variables' }),
    fallbackSystemPrompt: composeSystemPrompt({ ...promptBase, callContext: cartesiaToolAvailable ? 'tool' : 'none' }),
    knowledgeAppendix: appendix.trim(),
    firstMessage,
    voiceId: agent.voice_id,
    voiceTuning: readVoiceTuning(agent.voice_settings),
    fallbackVoiceId: agent.fallback_voice_id,
    timezone,
    conversation,
    transfer,
    analysis: readAnalysisSettings(agent.analysis_settings),
    privacy,
    knowledge,
    dynamicVariables: readDynamicVariables(agent.dynamic_variables),
    appRouted,
    revision: agent.config_revision ?? 1,
  }
}
