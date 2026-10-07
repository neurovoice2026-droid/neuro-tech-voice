import 'server-only'
// Loads everything a provider needs about one local agent and turns it into a
// provider-neutral AgentSpec. The ElevenLabs and Cartesia agents are both
// built from this, which is what keeps primary and fallback consistent.

import type { SupabaseClient } from '@supabase/supabase-js'
import { composeSystemPrompt } from './prompt'
import {
  readAfterHours,
  readAnalysisSettings,
  readConversationSettings,
  readDynamicVariables,
  readPrivacySettings,
  readTransferSettings,
  readVoiceTuning,
  readWorkingHours,
} from './settings'
import type { AgentSpec } from './types'
import { safeTimeZone } from '@/lib/scheduling/time'
import { applyDisclosure } from '@/lib/voice/greetings'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { textNormalisationType } from '@/lib/elevenlabs/models'
import { effectiveAdditionalLanguages, languagePresetGreetings } from './language-presets'
import { stripPlatformVariables } from './template-variables'
import { callLimitsFor } from './call-limits'
import { describeOpeningHours } from './opening-hours'

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

/** Finished website imports of the agent: one RAG folder each (pages live in the provider's folder). */
async function loadWebsiteKnowledge(
  db: SupabaseClient,
  agent: Pick<AgentRow, 'id' | 'org_id'>,
): Promise<Array<{ host: string; rootFolderId: string; excerpt: string | null }>> {
  const { data, error } = await db
    .from('knowledge_crawls')
    .select('host, root_folder_id, content_excerpt')
    .eq('agent_id', agent.id)
    .eq('org_id', agent.org_id)
    .eq('status', 'succeeded')
    .not('root_folder_id', 'is', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`knowledge_crawls read failed: ${error.message}`)
  return (data ?? []).map((c) => ({
    host: String(c.host),
    rootFolderId: String(c.root_folder_id),
    excerpt: typeof c.content_excerpt === 'string' ? c.content_excerpt : null,
  }))
}

export async function loadAgentRow(db: SupabaseClient, agentId: string): Promise<AgentRow | null> {
  const { data, error } = await db.from('agents').select(AGENT_COLUMNS).eq('id', agentId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return (data as AgentRow | null) ?? null
}

export async function buildAgentSpec(db: SupabaseClient, agent: AgentRow): Promise<AgentSpec> {
  const [{ data: org, error: orgErr }, { data: docs, error: docErr }, { data: numbers, error: numErr }] = await Promise.all([
    db.from('organizations').select('id, name, timezone, plan').eq('id', agent.org_id).single(),
    db
      .from('knowledge_documents')
      .select('id, name, type, elevenlabs_doc_id, cartesia_doc_id, status, content_excerpt, usage_mode, size_bytes')
      .eq('agent_id', agent.id)
      .eq('org_id', agent.org_id)
      .in('status', ['ready', 'processing'])
      // A document being deleted is left out from the moment the delete starts.
      .is('deleting_at', null)
      .order('created_at', { ascending: true }),
    db.from('phone_numbers').select('routing_mode').eq('org_id', agent.org_id),
  ])
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
  if (docErr) throw new Error(`knowledge_documents read failed: ${docErr.message}`)
  if (numErr) throw new Error(`phone_numbers read failed: ${numErr.message}`)

  const language = normalizeAgentLanguage(agent.language)
  // Tenant text never references platform variables ({{ntv_*}}, {{secret__*}},
  // most {{system__*}}): the API rejects them, and anything stored earlier is
  // stripped here (defense in depth).
  const rawConversation = readConversationSettings(agent.conversation_settings ?? agent.metadata?.behavior_settings)
  const conversation = { ...rawConversation, voicemail_message: stripPlatformVariables(rawConversation.voicemail_message) }
  const rawTransfer = readTransferSettings(agent.transfer_settings)
  const transfer = { ...rawTransfer, condition: stripPlatformVariables(rawTransfer.condition), label: stripPlatformVariables(rawTransfer.label) }
  const systemPromptText = stripPlatformVariables(agent.system_prompt)
  const fallbackMessageText = stripPlatformVariables(agent.fallback_message)
  const privacy = readPrivacySettings(agent.privacy_settings, (agent.metadata?.behavior_settings as Record<string, unknown> | undefined)?.record_calls)
  const timezone = safeTimeZone(org?.timezone as string | null)
  const orgName = (org?.name as string | null) ?? null

  // New orgs (no number yet) default to app routing, the only mode with failover.
  const modes = (numbers ?? []).map((n) => n.routing_mode as string)
  const appRouted = modes.length === 0 || modes.some((m) => m === 'app_routed')
  const hasNativeNumbers = modes.some((m) => m === 'native_elevenlabs')
  const openingHours = describeOpeningHours(readWorkingHours(agent.working_hours), readAfterHours(agent.after_hours))

  const promptBase = {
    system_prompt: systemPromptText,
    language,
    fallback_message: fallbackMessageText,
    businessName: orgName,
    timezone,
    transferEnabled: transfer.enabled && !!transfer.number,
    transferLabel: transfer.label,
    // Both modes: the app-routed webhook tool cannot carry the condition.
    transferCondition: transfer.condition,
    endCallEnabled: conversation.allow_end_call,
  }
  const cartesiaToolAvailable = (process.env.CARTESIA_TOOL_SECRET ?? '').trim().length >= 24
  // ElevenLabs only: the Cartesia fallback agent stays single-language.
  const additionalLanguages = effectiveAdditionalLanguages(language, conversation.additional_languages)

  // The first thing a caller hears always discloses the AI (and recording,
  // when enabled), whatever the customer typed. Idempotent.
  const firstMessage = applyDisclosure(stripPlatformVariables(agent.first_message), {
    language,
    businessName: orgName ?? '',
    recordingNotice: conversation.recording_notice,
  })

  const websites = await loadWebsiteKnowledge(db, agent)
  const knowledge: AgentSpec['knowledge'] = [
    ...(docs ?? [])
      .filter((d) => d.status === 'ready' || d.elevenlabs_doc_id)
      .map((d) => ({
        name: String(d.name),
        type: (d.type === 'url' ? 'url' : d.type === 'text' ? 'text' : 'file') as 'file' | 'url' | 'text',
        elevenlabsId: (d.elevenlabs_doc_id as string | null) ?? null,
        cartesiaId: (d.cartesia_doc_id as string | null) ?? null,
        usageMode: (d.usage_mode === 'prompt' ? 'prompt' : 'auto') as 'auto' | 'prompt',
        sizeBytes: typeof d.size_bytes === 'number' && d.size_bytes > 0 ? d.size_bytes : null,
      })),
    ...websites.map((w) => ({
      name: `Website: ${w.host}`.slice(0, 200),
      type: 'folder' as const,
      elevenlabsId: w.rootFolderId,
      cartesiaId: null,
      usageMode: 'auto' as const,
      sizeBytes: null,
    })),
  ]

  let appendix = ''
  const excerpts = [
    ...(docs ?? []).map((d) => ({ name: String(d.name), excerpt: d.content_excerpt })),
    ...websites.map((w) => ({ name: `Website ${w.host}`, excerpt: w.excerpt })),
  ]
  for (const d of excerpts) {
    const excerpt = typeof d.excerpt === 'string' ? d.excerpt.slice(0, MAX_EXCERPT_PER_DOC) : ''
    if (!excerpt) continue
    const block = `### ${d.name.slice(0, 120)}\n${excerpt}\n`
    if (appendix.length + block.length > MAX_APPENDIX_CHARS) break
    appendix += block
  }

  return {
    localAgentId: agent.id,
    orgId: agent.org_id,
    orgName,
    name: agent.name,
    language,
    systemPrompt: composeSystemPrompt({
      ...promptBase,
      callContext: 'variables',
      voicemailDetection: conversation.voicemail_detection,
      skipTurn: conversation.skip_turn,
      additionalLanguages,
      numbersAsDigits: textNormalisationType() === 'elevenlabs',
      keypadInput: true,
      // Org with app-routed AND native numbers: both transfer tools are attached.
      mixedTransferTools: appRouted && hasNativeNumbers,
      openingHours,
    }),
    fallbackSystemPrompt: composeSystemPrompt({ ...promptBase, callContext: cartesiaToolAvailable ? 'tool' : 'none' }),
    knowledgeAppendix: appendix.trim(),
    firstMessage,
    languagePresetGreetings: languagePresetGreetings({
      languages: additionalLanguages,
      tone: agent.metadata?.personality,
      orgName,
      agentName: agent.name,
      recordingNotice: conversation.recording_notice,
    }),
    voiceId: agent.voice_id,
    voiceTuning: readVoiceTuning(agent.voice_settings),
    fallbackVoiceId: agent.fallback_voice_id,
    timezone,
    conversation,
    transfer,
    analysis: readAnalysisSettings(agent.analysis_settings),
    privacy,
    knowledge,
    dynamicVariables: Object.fromEntries(
      Object.entries(readDynamicVariables(agent.dynamic_variables)).map(([k, v]) => [k, stripPlatformVariables(v)]),
    ),
    appRouted,
    hasNativeNumbers,
    active: agent.is_active !== false,
    callLimits: callLimitsFor(org?.plan),
    openingHours,
    revision: agent.config_revision ?? 1,
  }
}
