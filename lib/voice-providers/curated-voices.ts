import 'server-only'
// Curated platform voices per agent language: the voices offered first, given
// to new agents without a choice and used to migrate agents off the retired
// ElevenLabs default voices. Never hardcoded: an admin asks for proposals
// (public Voice Library, conversational, studio quality, verified for the
// language, sorted by trending then by clones) and approves the ones to
// provision as platform-wide library voices (owner_org_id NULL) with
// featured_languages / featured_rank (migration 015).

import { AGENT_LANGUAGES, type AgentLanguageCode } from '@/lib/agent-languages'
import { searchLibrary, type ELLibraryVoice, type LibrarySort } from '@/lib/elevenlabs/api/voices'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { libraryMinNoticeDays } from './config'
import { isProviderError } from './errors'
import {
  EL_OWNER_ID_RE,
  EL_VOICE_ID_RE,
  findLibraryVoice,
  isUsableLibraryVoice,
  libraryLanguageFit,
  normalizeLanguage,
  provisionPlatformLibraryVoice,
  writeAudit,
} from './voice-catalog'

export const CURATED_LANGUAGES = AGENT_LANGUAGES.map((l) => l.value) as AgentLanguageCode[]

export interface CuratedCandidate {
  language: string
  public_owner_id: string
  voice_id: string
  name: string
  gender: string | null
  accent: string | null
  age: string | null
  use_case: string | null
  category: string | null
  cloned_by_count: number | null
  notice_period_days: number | null
  /** Models the voice is verified with for this language. */
  verified_models: string[]
  /** 2 = verified with the agent's model for the language, 1 = verified. */
  language_fit: number
  preview_url: string | null
  /** The workspace copy, when the platform already provisioned this voice. */
  provisioned_voice_id: string | null
}

export interface CuratedCurrent {
  voice_id: string
  name: string | null
  featured_rank: number | null
  notice: string | null
}

export interface CuratedProposal {
  language: string
  current: CuratedCurrent[]
  candidates: CuratedCandidate[]
  error: string | null
}

const SORTS: LibrarySort[] = ['trending', 'cloned_by_count']

function toCandidate(v: ELLibraryVoice, language: string, provisioned: Map<string, string>): CuratedCandidate {
  const verified = (v.verified_languages ?? []).filter((l) => normalizeLanguage(l.language) === language)
  return {
    language,
    public_owner_id: v.public_owner_id,
    voice_id: v.voice_id,
    name: (v.name ?? '').slice(0, 100),
    gender: v.gender ?? null,
    accent: v.accent ?? null,
    age: v.age ?? null,
    use_case: v.use_case ?? null,
    category: v.category ?? null,
    cloned_by_count: typeof v.cloned_by_count === 'number' ? v.cloned_by_count : null,
    notice_period_days: typeof v.notice_period === 'number' ? v.notice_period : null,
    verified_models: [...new Set(verified.map((l) => l.model_id).filter((m): m is string => typeof m === 'string'))],
    language_fit: libraryLanguageFit(v, language),
    preview_url: typeof v.preview_url === 'string' && v.preview_url.startsWith('https://') ? v.preview_url : null,
    provisioned_voice_id: provisioned.get(v.voice_id) ?? null,
  }
}

/** Library voices worth curating for each language (read-only). */
export async function proposeCuratedVoices(params: { languages: string[]; perLanguage: number; log: Logger }): Promise<CuratedProposal[]> {
  const db = createAdminClient()
  const out: CuratedProposal[] = []
  for (const language of params.languages) {
    const proposal: CuratedProposal = { language, current: [], candidates: [], error: null }
    try {
      const { data: current, error } = await db
        .from('provider_voices')
        .select('voice_id, name, featured_rank, notice')
        .eq('provider', 'elevenlabs')
        .is('owner_org_id', null)
        .contains('featured_languages', [language])
        .order('featured_rank', { ascending: true, nullsFirst: false })
      if (error) throw new Error(`provider_voices read failed: ${error.message}`)
      proposal.current = (current ?? []) as CuratedCurrent[]

      const seen = new Map<string, { v: ELLibraryVoice; order: number }>()
      let order = 0
      for (const sort of SORTS) {
        const res = await searchLibrary({
          language,
          use_cases: ['conversational'],
          category: 'high_quality',
          sort,
          page_size: 30,
          min_notice_period_days: libraryMinNoticeDays(),
        })
        for (const v of res.voices ?? []) {
          if (!seen.has(v.voice_id)) seen.set(v.voice_id, { v, order: order++ })
        }
      }
      const usable = [...seen.values()]
        .filter(({ v }) => isUsableLibraryVoice(v) && libraryLanguageFit(v, language) > 0)
        .sort((a, b) => libraryLanguageFit(b.v, language) - libraryLanguageFit(a.v, language) || a.order - b.order)
        .slice(0, params.perLanguage)
      const ids = usable.map(({ v }) => v.voice_id)
      const provisioned = new Map<string, string>()
      if (ids.length) {
        const { data: rows, error: rowsErr } = await db
          .from('provider_voices')
          .select('voice_id, source_voice_id')
          .eq('provider', 'elevenlabs')
          .eq('source', 'library')
          .eq('status', 'ready')
          .is('owner_org_id', null)
          .in('source_voice_id', ids)
        if (rowsErr) throw new Error(`provider_voices read failed: ${rowsErr.message}`)
        for (const r of rows ?? []) provisioned.set(r.source_voice_id as string, r.voice_id as string)
      }
      proposal.candidates = usable.map(({ v }) => toCandidate(v, language, provisioned))
    } catch (err) {
      params.log.error('curated_voices.propose_failed', err, { language })
      proposal.error = isProviderError(err) ? err.safeMessage : 'Could not read the voice library.'
    }
    out.push(proposal)
  }
  return out
}

export interface CuratedApproval {
  language: string
  public_owner_id: string
  voice_id: string
  rank: number
}

export interface CuratedRemoval {
  language: string
  /** The workspace voice id of the curated row. */
  voice_id: string
}

export interface CuratedApplyResult {
  approved: Array<{ language: string; library_voice_id: string; voice_id: string | null; status: 'curated' | 'not_available' | 'language_not_verified' | 'failed'; error?: string }>
  removed: Array<{ language: string; voice_id: string; status: 'removed' | 'not_found' | 'failed' }>
}

async function setFeatured(voiceId: string, language: string, rank: number | null, add: boolean): Promise<boolean> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('provider_voices')
    .select('id, featured_languages, featured_rank')
    .eq('provider', 'elevenlabs')
    .eq('voice_id', voiceId)
    .is('owner_org_id', null)
    .maybeSingle()
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  if (!data) return false
  const current = Array.isArray(data.featured_languages) ? (data.featured_languages as string[]) : []
  const next = add ? [...new Set([...current, language])] : current.filter((l) => l !== language)
  const { error: updErr } = await db
    .from('provider_voices')
    .update({ featured_languages: next.length ? next : null, featured_rank: next.length ? (rank ?? (data.featured_rank as number | null) ?? 100) : null })
    .eq('id', data.id)
    .is('owner_org_id', null)
  if (updErr) throw new Error(`provider_voices update failed: ${updErr.message}`)
  return true
}

/**
 * Provisions the approved library voices (re-validated server-side against
 * the library: usable, verified for the language) as platform-wide curated
 * voices, and removes curation where asked. Audited with the admin actor.
 */
export async function applyCuratedVoices(params: {
  approve: CuratedApproval[]
  remove: CuratedRemoval[]
  actor: { userId: string | null; kind: 'admin_token' | 'admin_user' }
  log: Logger
}): Promise<CuratedApplyResult> {
  const { log } = params
  const db = createAdminClient()
  const result: CuratedApplyResult = { approved: [], removed: [] }
  for (const item of params.approve) {
    const base = { language: item.language, library_voice_id: item.voice_id }
    if (!EL_OWNER_ID_RE.test(item.public_owner_id) || !EL_VOICE_ID_RE.test(item.voice_id)) {
      result.approved.push({ ...base, voice_id: null, status: 'not_available' })
      continue
    }
    try {
      const lib = await findLibraryVoice(item.public_owner_id, item.voice_id)
      if (!lib) {
        result.approved.push({ ...base, voice_id: null, status: 'not_available' })
        continue
      }
      if (libraryLanguageFit(lib, item.language) === 0) {
        result.approved.push({ ...base, voice_id: null, status: 'language_not_verified' })
        continue
      }
      const { voiceId } = await provisionPlatformLibraryVoice({ lib, actor: params.actor, log })
      await setFeatured(voiceId, item.language, item.rank, true)
      await writeAudit(
        db,
        {
          orgId: null,
          userId: params.actor.userId,
          actorKind: params.actor.kind,
          action: 'voice.curated.added',
          targetId: voiceId,
          details: { language: item.language, rank: item.rank, library_voice_id: lib.voice_id, public_owner_id: lib.public_owner_id },
        },
        log,
      )
      result.approved.push({ ...base, voice_id: voiceId, status: 'curated' })
    } catch (err) {
      log.error('curated_voices.approve_failed', err, { language: item.language, libraryVoiceId: item.voice_id })
      result.approved.push({ ...base, voice_id: null, status: 'failed', error: isProviderError(err) ? err.safeMessage : 'failed' })
    }
  }
  for (const item of params.remove) {
    try {
      const found = await setFeatured(item.voice_id, item.language, null, false)
      if (found) {
        await writeAudit(
          db,
          { orgId: null, userId: params.actor.userId, actorKind: params.actor.kind, action: 'voice.curated.removed', targetId: item.voice_id, details: { language: item.language } },
          log,
        )
      }
      result.removed.push({ language: item.language, voice_id: item.voice_id, status: found ? 'removed' : 'not_found' })
    } catch (err) {
      log.error('curated_voices.remove_failed', err, { language: item.language, voiceId: item.voice_id })
      result.removed.push({ language: item.language, voice_id: item.voice_id, status: 'failed' })
    }
  }
  return result
}
