// Single source of truth for agent language options, used by both the
// onboarding voice/agent step and the dashboard agent settings, so the two
// can never drift apart (they previously had different, inconsistent lists).
// `country` is an ISO 3166-1 alpha-2 code for <FlagIcon />, not the language
// itself - flags represent countries, not languages.
export const AGENT_LANGUAGES = [
  { value: 'en', label: 'English', country: 'US' },
  { value: 'ro', label: 'Romanian', country: 'RO' },
  { value: 'es', label: 'Spanish', country: 'ES' },
  { value: 'fr', label: 'French', country: 'FR' },
  { value: 'de', label: 'German', country: 'DE' },
  { value: 'it', label: 'Italian', country: 'IT' },
  { value: 'pt', label: 'Portuguese', country: 'PT' },
  { value: 'pl', label: 'Polish', country: 'PL' },
  { value: 'nl', label: 'Dutch', country: 'NL' },
  { value: 'ja', label: 'Japanese', country: 'JP' },
  { value: 'ko', label: 'Korean', country: 'KR' },
  { value: 'zh', label: 'Chinese (Mandarin)', country: 'CN' },
  { value: 'ar', label: 'Arabic', country: 'SA' },
  { value: 'hi', label: 'Hindi', country: 'IN' },
] as const

export type AgentLanguageCode = (typeof AGENT_LANGUAGES)[number]['value']
