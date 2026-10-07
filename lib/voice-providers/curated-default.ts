// Curated platform voice per language (migration 015: featured_languages /
// featured_rank on platform-wide library rows), and the explicit voice a NEW
// agent gets when the tenant picked none. Kept free of provider/sync imports:
// the agent spec loader uses it.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/observability/logger'
import { normalizeAgentLanguage } from '@/lib/voice/languages'

const VOICE_ID_RE = /^[A-Za-z0-9]{8,64}$/

export interface CuratedVoice {
  voiceId: string
  name: string
  rank: number | null
}

/**
 * Curated platform voices for a language, best first. Only ready,
 * platform-wide library rows without a lifecycle notice qualify.
 */
export async function curatedVoices(db: SupabaseClient, language: string, limit = 10): Promise<CuratedVoice[]> {
  const lang = normalizeAgentLanguage(language)
  const { data, error } = await db
    .from('provider_voices')
    .select('voice_id, name, featured_rank')
    .eq('provider', 'elevenlabs')
    .eq('source', 'library')
    .eq('status', 'ready')
    .is('owner_org_id', null)
    .is('notice', null)
    .contains('featured_languages', [lang])
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  return (data ?? [])
    .filter((r) => typeof r.voice_id === 'string' && VOICE_ID_RE.test(r.voice_id))
    .map((r) => ({ voiceId: r.voice_id as string, name: (r.name as string | null) ?? 'Voice', rank: (r.featured_rank as number | null) ?? null }))
}

export async function curatedDefaultVoice(db: SupabaseClient, language: string): Promise<CuratedVoice | null> {
  return (await curatedVoices(db, language, 1))[0] ?? null
}

/**
 * The explicit voice a NEW agent (no ElevenLabs agent yet) gets when the
 * tenant picked none: the curated voice of its language, so the API default
 * (a retiring premade voice) never applies. Null for an agent that already
 * exists at the provider (its voice is never switched silently) or when no
 * curated voice exists (logged).
 */
export async function defaultVoiceForNewAgent(db: SupabaseClient, agent: { id: string; language: string | null }): Promise<string | null> {
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('external_id')
    .eq('agent_id', agent.id)
    .eq('provider', 'elevenlabs')
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  if (data?.external_id) return null
  const curated = await curatedDefaultVoice(db, agent.language ?? 'en')
  if (!curated) {
    createLogger({ component: 'default_voice', agentId: agent.id }).warn('default_voice.no_curated_voice', { language: normalizeAgentLanguage(agent.language) })
    return null
  }
  return curated.voiceId
}
