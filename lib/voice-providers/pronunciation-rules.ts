// Pronunciation rules of an organization's agent: validation, the stored
// shape (agents.pronunciation, migration 015) and the ElevenLabs locator.
// Pure module (no I/O): used by the agent spec, previews and the API route.
//
// Only alias rules are offered ("say this word as …"): they work with every
// TTS model, including eleven_flash_v2_5 used for Romanian; phoneme rules only
// work with a few models (ElevenLabs pronunciation-dictionary docs).

import { z } from 'zod'
import type { AliasRule } from '@/lib/elevenlabs/api/pronunciation'

export const PRONUNCIATION_LIMITS = {
  maxRules: 100,
  termMaxChars: 64,
  sayAsMaxChars: 128,
} as const

/** Provider ids are opaque; only plain id characters are ever stored or sent. */
export const DICTIONARY_ID_RE = /^[A-Za-z0-9_-]{4,128}$/

/** NFC, control characters removed, whitespace collapsed. */
export function cleanRuleText(raw: string): string {
  return raw.normalize('NFC').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
}

const ruleText = (max: number, label: string) =>
  z
    .string()
    .max(max * 4)
    .transform(cleanRuleText)
    .pipe(
      z
        .string()
        .min(1, `${label} is required.`)
        .refine((v) => Array.from(v).length <= max, `${label} is too long (max ${max} characters).`)
        // Letters, digits, spaces and common punctuation of names and acronyms.
        .refine((v) => /^[\p{L}\p{M}\p{N} .,'’&+/()-]+$/u.test(v), `${label} contains unsupported characters.`),
    )

export const PronunciationRuleSchema = z
  .object({
    term: ruleText(PRONUNCIATION_LIMITS.termMaxChars, 'The word'),
    say_as: ruleText(PRONUNCIATION_LIMITS.sayAsMaxChars, 'The pronunciation'),
    case_sensitive: z.boolean().optional().default(false),
    word_boundaries: z.boolean().optional().default(true),
  })
  .strict()

export type PronunciationRule = z.infer<typeof PronunciationRuleSchema>

export const PronunciationRulesSchema = z
  .array(PronunciationRuleSchema)
  .max(PRONUNCIATION_LIMITS.maxRules, `At most ${PRONUNCIATION_LIMITS.maxRules} words.`)
  .superRefine((rules, ctx) => {
    const seen = new Set<string>()
    rules.forEach((r, i) => {
      const key = r.term.toLowerCase()
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [i, 'term'], message: `"${r.term}" is listed twice.` })
      seen.add(key)
    })
  })

/** agents.pronunciation as stored by the platform. */
export interface PronunciationState {
  dictionary_id: string
  version_id: string
  rules: PronunciationRule[]
  updated_at?: string
}

const StoredSchema = z.object({
  dictionary_id: z.string().regex(DICTIONARY_ID_RE),
  version_id: z.string().regex(DICTIONARY_ID_RE),
  rules: z.array(
    z.object({
      term: z.string().min(1).max(PRONUNCIATION_LIMITS.termMaxChars * 4),
      say_as: z.string().min(1).max(PRONUNCIATION_LIMITS.sayAsMaxChars * 4),
      case_sensitive: z.boolean().default(false),
      word_boundaries: z.boolean().default(true),
    }),
  ).max(PRONUNCIATION_LIMITS.maxRules),
  updated_at: z.string().optional(),
})

/** The stored state, or null when absent/invalid (an invalid value is never sent to the provider). */
export function readPronunciation(raw: unknown): PronunciationState | null {
  const parsed = StoredSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export interface PronunciationLocator {
  dictionaryId: string
  versionId: string
}

/** The version the agent and the previews must use; null without rules. */
export function pronunciationLocatorOf(raw: unknown): PronunciationLocator | null {
  const state = readPronunciation(raw)
  if (!state || state.rules.length === 0) return null
  return { dictionaryId: state.dictionary_id, versionId: state.version_id }
}

/** tts.pronunciation_dictionary_locators / TTS body entry (PydanticPronunciationDictionaryVersionLocator). */
export function locatorBody(locator: PronunciationLocator): { pronunciation_dictionary_id: string; version_id: string } {
  return { pronunciation_dictionary_id: locator.dictionaryId, version_id: locator.versionId }
}

export function toAliasRules(rules: readonly PronunciationRule[]): AliasRule[] {
  return rules.map((r) => ({
    type: 'alias',
    string_to_replace: r.term,
    alias: r.say_as,
    case_sensitive: r.case_sensitive,
    word_boundaries: r.word_boundaries,
  }))
}

/** What changed between two rule sets, keyed by the exact term (the provider's string_to_replace). */
export function diffRules(prev: readonly PronunciationRule[], next: readonly PronunciationRule[]): { upserts: PronunciationRule[]; removed: string[] } {
  const before = new Map(prev.map((r) => [r.term, r]))
  const after = new Map(next.map((r) => [r.term, r]))
  const upserts = next.filter((r) => {
    const old = before.get(r.term)
    return !old || old.say_as !== r.say_as || old.case_sensitive !== r.case_sensitive || old.word_boundaries !== r.word_boundaries
  })
  const removed = prev.filter((r) => !after.has(r.term)).map((r) => r.term)
  return { upserts, removed }
}
