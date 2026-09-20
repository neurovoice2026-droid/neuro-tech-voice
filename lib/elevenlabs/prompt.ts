// The prompt composer moved to lib/voice/prompt.ts when the voice pipeline
// became provider-neutral (Cartesia first, ElevenLabs as fallback). This file
// keeps existing imports working, including the client-side one in
// components/agent/tabs/TabConversation.tsx.

export {
  composeCallContext,
  composeSystemPrompt,
  defaultFallbackMessage,
  defaultNotInDocumentsMessage,
} from '@/lib/voice/prompt'
export type { ComposePromptInput } from '@/lib/voice/prompt'
