// Moved to lib/voice-providers/prompt.ts (shared by ElevenLabs and Cartesia).
// Kept as a re-export so existing client imports (defaultFallbackMessage)
// keep working.
export { composeSystemPrompt, defaultFallbackMessage } from '@/lib/voice-providers/prompt'
