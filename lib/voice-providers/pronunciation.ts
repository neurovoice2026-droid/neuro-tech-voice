import 'server-only'
// The organization's pronunciation dictionary (ElevenLabs), one per org.
//
// • First save with rules: POST add-from-rules (name `ntv:<env>:org:<orgId>`,
//   no workspace access). Later saves: remove-rules for the removed words and
//   add-rules for new/changed ones (each call is a new version); when the
//   provider's latest version is not the one we stored (a previous save was
//   interrupted), set-rules resynchronises everything in one call.
// • agents.pronunciation {dictionary_id, version_id, rules} is written with a
//   compare-and-set on the stored version, so two concurrent saves cannot
//   interleave; the agent then gets tts.pronunciation_dictionary_locators with
//   that exact version (agent-config.ts) and previews use it too.
// • Offboarding: deleteOrgPronunciation(orgId) empties the rules (they hold
//   staff names: personal data) and archives the dictionary; the API has no
//   DELETE. Exported for the account-deletion flow (slice H).
// Ids are never accepted from a browser and dictionaries are never listed.

import { RequestError } from '@/lib/api/http'
import {
  addRules,
  archiveDictionary,
  createDictionary,
  getDictionary,
  removeRules,
  setRules,
  type DictionaryVersion,
} from '@/lib/elevenlabs/api/pronunciation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import type { RateLimitRule } from '@/lib/security/rate-limit'
import { isProviderError } from './errors'
import {
  DICTIONARY_ID_RE,
  diffRules,
  readPronunciation,
  toAliasRules,
  type PronunciationRule,
  type PronunciationState,
} from './pronunciation-rules'
import { writeAudit } from './voice-catalog'

/** Saves create provider versions: bounded per org. */
export const PRONUNCIATION_SAVE_LIMIT: RateLimitRule = { name: 'pronunciation_save', limit: 30, windowSeconds: 3_600 }

export function dictionaryName(orgId: string): string {
  const env = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development').slice(0, 20)
  return `ntv:${env}:org:${orgId}`
}

function assertVersion(v: DictionaryVersion | null | undefined): DictionaryVersion {
  if (!v || !DICTIONARY_ID_RE.test(v.id ?? '') || !DICTIONARY_ID_RE.test(v.version_id ?? '')) {
    throw new Error('pronunciation dictionary response without a valid id/version')
  }
  return v
}

function sameRules(a: readonly PronunciationRule[], b: readonly PronunciationRule[]): boolean {
  if (a.length !== b.length) return false
  const { upserts, removed } = diffRules(a, b)
  return upserts.length === 0 && removed.length === 0
}

function concurrentEdit(): RequestError {
  return new RequestError('conflict', 'Your pronunciation list was changed in another window. Reload the page and try again.', 409)
}

/**
 * Empties and archives one dictionary. 'gone' when the provider no longer
 * has it. Throws on provider failures (callers decide).
 */
export async function retireDictionary(dictionaryId: string): Promise<'archived' | 'gone'> {
  if (!DICTIONARY_ID_RE.test(dictionaryId)) return 'gone'
  let terms: string[]
  try {
    const detail = await getDictionary(dictionaryId)
    terms = (detail.rules ?? []).map((r) => r.string_to_replace).filter((s): s is string => typeof s === 'string' && s.length > 0)
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') return 'gone'
    throw err
  }
  if (terms.length) await removeRules(dictionaryId, terms)
  await archiveDictionary(dictionaryId)
  return 'archived'
}

async function readState(orgId: string, agentId: string): Promise<PronunciationState | null> {
  const { data, error } = await createAdminClient().from('agents').select('pronunciation').eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  if (!data) throw new RequestError('not_found', 'Agent not found. Finish setting up your agent first.', 404)
  return readPronunciation(data.pronunciation)
}

async function createFor(orgId: string, rules: PronunciationRule[]): Promise<DictionaryVersion> {
  return assertVersion(
    await createDictionary(
      {
        name: dictionaryName(orgId),
        description: 'Pronunciation rules of one organization (managed by the platform).',
        rules: toAliasRules(rules),
      },
      { orgId },
    ),
  )
}

/**
 * Saves the organization's rules (already validated by PronunciationRulesSchema).
 * Returns the stored state and whether anything changed at the provider.
 */
export async function savePronunciationRules(params: {
  orgId: string
  agentId: string
  userId: string
  rules: PronunciationRule[]
  log: Logger
}): Promise<{ state: PronunciationState | null; changed: boolean }> {
  const { orgId, agentId, rules } = params
  const log = params.log.child({ component: 'pronunciation' })
  const db = createAdminClient()
  const prev = await readState(orgId, agentId)

  if (prev && sameRules(prev.rules, rules)) return { state: prev, changed: false }
  if (!prev && rules.length === 0) return { state: null, changed: false }

  let version: DictionaryVersion
  let created = false
  if (!prev) {
    version = await createFor(orgId, rules)
    created = true
  } else {
    let latest: string | null
    try {
      latest = (await getDictionary(prev.dictionary_id, { orgId })).latest_version_id ?? null
    } catch (err) {
      if (!(isProviderError(err) && err.code === 'not_found')) throw err
      latest = null
    }
    if (latest === null) {
      // The dictionary disappeared at the provider: start a new one.
      if (rules.length === 0) {
        version = { id: prev.dictionary_id, version_id: prev.version_id, version_rules_num: 0 }
      } else {
        version = await createFor(orgId, rules)
        created = true
      }
    } else if (latest !== prev.version_id) {
      // An earlier save stopped half-way: resynchronise every rule in one version.
      log.warn('pronunciation.resync', { stored: prev.version_id, latest })
      version = assertVersion(await setRules(prev.dictionary_id, toAliasRules(rules), { orgId }))
    } else {
      const { upserts, removed } = diffRules(prev.rules, rules)
      let v: DictionaryVersion | null = null
      if (removed.length) v = assertVersion(await removeRules(prev.dictionary_id, removed, { orgId }))
      if (upserts.length) v = assertVersion(await addRules(prev.dictionary_id, toAliasRules(upserts), { orgId }))
      version = v ?? { id: prev.dictionary_id, version_id: prev.version_id, version_rules_num: prev.rules.length }
    }
  }

  const next: PronunciationState = { dictionary_id: version.id, version_id: version.version_id, rules, updated_at: new Date().toISOString() }
  // Compare-and-set on what we read: a concurrent save makes this one fail cleanly.
  let update = db.from('agents').update({ pronunciation: next }).eq('id', agentId).eq('org_id', orgId)
  update = prev ? update.eq('pronunciation->>version_id', prev.version_id) : update.is('pronunciation', null)
  const { data: written, error } = await update.select('id')
  if (error || !written?.length) {
    if (created) {
      // Our new dictionary is not referenced anywhere: retire it again.
      try {
        await retireDictionary(version.id)
      } catch (err) {
        log.error('pronunciation.orphan_retire_failed', err, { dictionaryId: version.id })
      }
    }
    if (error) throw new Error(`agents pronunciation update failed: ${error.message}`)
    throw concurrentEdit()
  }
  if (created && prev && prev.dictionary_id !== version.id) {
    log.info('pronunciation.replaced_missing_dictionary', { previous: prev.dictionary_id, dictionaryId: version.id })
  }

  const diff = diffRules(prev?.rules ?? [], rules)
  log.info('pronunciation.saved', { dictionaryId: version.id, versionId: version.version_id, rules: rules.length })
  await writeAudit(
    db,
    {
      orgId,
      userId: params.userId,
      action: 'voice.pronunciation.updated',
      targetId: version.id,
      targetType: 'pronunciation_dictionary',
      // Counts only: the rules hold names (personal data).
      details: { rules: rules.length, upserted: diff.upserts.length, removed: diff.removed.length, version_id: version.version_id },
    },
    log,
  )
  return { state: next, changed: true }
}

/**
 * Offboarding (slice H): empties and archives the organization's
 * dictionaries and clears agents.pronunciation. Never throws for provider
 * failures; returns counts. Run it before the organization row is deleted
 * (the purge queue of migration 015 is the safety net).
 */
export async function deleteOrgPronunciation(orgId: string, log: Logger): Promise<{ archived: number; gone: number; failed: number }> {
  const db = createAdminClient()
  const out = { archived: 0, gone: 0, failed: 0 }
  const { data, error } = await db.from('agents').select('id, pronunciation').eq('org_id', orgId)
  if (error) {
    log.error('pronunciation.offboarding_read_failed', error, { orgId })
    out.failed++
    return out
  }
  for (const a of data ?? []) {
    const state = readPronunciation(a.pronunciation)
    if (!state) continue
    try {
      const res = await retireDictionary(state.dictionary_id)
      out[res]++
      const { error: clearErr } = await db.from('agents').update({ pronunciation: null }).eq('id', a.id).eq('org_id', orgId)
      if (clearErr) log.error('pronunciation.offboarding_clear_failed', clearErr, { agentId: a.id })
    } catch (err) {
      out.failed++
      log.error('pronunciation.offboarding_failed', err, { orgId, agentId: a.id })
    }
  }
  return out
}
