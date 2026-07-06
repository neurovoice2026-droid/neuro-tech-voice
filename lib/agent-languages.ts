// Single source of truth for agent language options, used by both the
// onboarding voice/agent step and the dashboard agent settings, so the two
// can never drift apart (they previously had different, inconsistent lists).
export const AGENT_LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ro', label: 'Romanian', flag: '🇷🇴' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'it', label: 'Italian', flag: '🇮🇹' },
  { value: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { value: 'pl', label: 'Polish', flag: '🇵🇱' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { value: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { value: 'ko', label: 'Korean', flag: '🇰🇷' },
  { value: 'zh', label: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { value: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { value: 'hi', label: 'Hindi', flag: '🇮🇳' },
] as const

export type AgentLanguageCode = (typeof AGENT_LANGUAGES)[number]['value']
