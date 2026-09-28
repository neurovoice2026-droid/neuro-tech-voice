// Localized lines the gateway speaks on its own (silence prompts, wrap-up,
// fillers, hand-off resume). Single source of truth is the app's
// lib/voice/greetings.ts: pure data + string helpers with no runtime
// dependencies beyond other pure modules, bundled into the gateway.
export {
  FILLER_PHRASES,
  GOODBYE_SILENCE,
  RESUME_AFTER_HANDOFF,
  STILL_THERE,
  WRAP_UP,
  localized,
  localizedList,
} from '@/lib/voice/greetings'
