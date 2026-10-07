// Additional agent languages (ElevenLabs language presets): which languages
// apply, and the first message spoken in each. Every per-language greeting goes
// through applyDisclosure exactly like the primary greeting, so the AI
// disclosure (and the recording notice, when enabled) is never lost when the
// conversation runs in another language. Pure, client-safe.

import { MAX_ADDITIONAL_LANGUAGES } from './settings'
import { applyDisclosure, greetingFor } from '@/lib/voice/greetings'
import { isSupportedAgentLanguage, normalizeAgentLanguage } from '@/lib/voice/languages'
import { normalizeTone } from '@/lib/voice/tone'

/**
 * The agent's additional languages: supported, de-duplicated, never the
 * primary language (it can change after the list was saved), at most
 * MAX_ADDITIONAL_LANGUAGES, in the order the tenant chose them.
 */
export function effectiveAdditionalLanguages(primary: string, requested: readonly string[] | null | undefined): string[] {
  const out: string[] = []
  for (const raw of requested ?? []) {
    if (typeof raw !== 'string' || !isSupportedAgentLanguage(raw)) continue
    const lang = normalizeAgentLanguage(raw)
    if (lang === primary || out.includes(lang)) continue
    out.push(lang)
    if (out.length === MAX_ADDITIONAL_LANGUAGES) break
  }
  return out
}

/** "<Company> Agent" / "My Agent" (the generated default) is not a name to introduce. */
function spokenAgentName(agentName: string, orgName: string): string {
  const name = agentName.trim()
  if (!name || name === 'My Agent' || (orgName && name === `${orgName} Agent`)) return ''
  return name
}

/**
 * First message per additional language: the generated greeting for the
 * agent's tone in that language, with the AI disclosure and (when enabled)
 * the recording notice. The customer's own greeting is written in the primary
 * language, so it is not reused here.
 */
export function languagePresetGreetings(input: {
  languages: readonly string[]
  tone: unknown
  orgName: string | null
  agentName: string
  recordingNotice: boolean
}): Record<string, string> {
  const company = (input.orgName ?? '').trim()
  const agentName = spokenAgentName(input.agentName, company)
  const tone = normalizeTone(input.tone)
  const out: Record<string, string> = {}
  for (const language of input.languages) {
    out[language] = applyDisclosure(greetingFor({ language, tone, company, agentName }), {
      language,
      businessName: company,
      recordingNotice: input.recordingNotice,
    })
  }
  return out
}
