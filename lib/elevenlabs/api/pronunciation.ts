import 'server-only'
// ElevenLabs pronunciation dictionaries (versioned word → pronunciation
// rules). Verified against the official OpenAPI spec (2026-10).
//
// Dictionaries are resources of the SHARED workspace: the platform creates one
// per organization, stores its id server-side and never accepts a dictionary
// id from a browser. workspace_access is never sent (spec: "If not provided,
// defaults to no access"). The API has no DELETE: a dictionary is emptied and
// then archived (PATCH archived=true).

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, type Ctx } from '../client'

const BASE = '/v1/pronunciation-dictionaries'
const enc = encodeURIComponent

/** PronunciationDictionaryAliasRuleRequestModel (phoneme rules are not offered). */
export interface AliasRule {
  type: 'alias'
  string_to_replace: string
  alias: string
  case_sensitive: boolean
  word_boundaries: boolean
}

/** PronunciationDictionaryRulesResponseModel / AddPronunciationDictionaryResponseModel (subset). */
export interface DictionaryVersion {
  id: string
  version_id: string
  version_rules_num: number
}

/** GetPronunciationDictionaryWithRulesResponseModel (subset). */
export interface DictionaryDetail {
  id: string
  latest_version_id: string
  latest_version_rules_num: number
  name: string
  archived_time_unix?: number | null
  rules: Array<{ type?: string; string_to_replace: string; alias?: string; phoneme?: string }>
}

/** POST /add-from-rules: creates the dictionary and its first version. Never retried (creates a resource). */
export function createDictionary(params: { name: string; description?: string; rules: AliasRule[] }, ctx?: Ctx) {
  return req<DictionaryVersion & { name: string }>('pronunciation.create', `${BASE}/add-from-rules`, {
    method: 'POST',
    body: { name: params.name, description: params.description ?? null, rules: params.rules },
    retry: NO_RETRY,
    ctx,
  })
}

/** POST /{id}/add-rules: adds rules (a rule with the same string_to_replace is replaced). New version. */
export function addRules(dictionaryId: string, rules: AliasRule[], ctx?: Ctx) {
  return req<DictionaryVersion>('pronunciation.add_rules', `${BASE}/${enc(dictionaryId)}/add-rules`, {
    method: 'POST',
    body: { rules },
    retry: NO_RETRY,
    ctx,
  })
}

/** POST /{id}/remove-rules: removes the rules whose string_to_replace is listed. New version. */
export function removeRules(dictionaryId: string, ruleStrings: string[], ctx?: Ctx) {
  return req<DictionaryVersion>('pronunciation.remove_rules', `${BASE}/${enc(dictionaryId)}/remove-rules`, {
    method: 'POST',
    body: { rule_strings: ruleStrings },
    retry: NO_RETRY,
    ctx,
  })
}

/** POST /{id}/set-rules: replaces every rule (used to resynchronise after drift). New version. */
export function setRules(dictionaryId: string, rules: AliasRule[], ctx?: Ctx) {
  return req<DictionaryVersion>('pronunciation.set_rules', `${BASE}/${enc(dictionaryId)}/set-rules`, {
    method: 'POST',
    body: { rules },
    retry: NO_RETRY,
    ctx,
  })
}

/** GET /{id}: metadata, latest version and its rules. */
export function getDictionary(dictionaryId: string, ctx?: Ctx) {
  return req<DictionaryDetail>('pronunciation.get', `${BASE}/${enc(dictionaryId)}`, { ctx })
}

/** PATCH /{id} {archived: true}: the API's only way to retire a dictionary. Idempotent. */
export function archiveDictionary(dictionaryId: string, ctx?: Ctx) {
  return req<{ id: string }>('pronunciation.archive', `${BASE}/${enc(dictionaryId)}`, {
    method: 'PATCH',
    body: { archived: true },
    idempotent: true,
    ctx,
  })
}
