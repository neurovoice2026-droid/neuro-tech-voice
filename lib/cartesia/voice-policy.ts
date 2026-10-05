// Which Cartesia voices a tenant's fallback agent may use: active public
// voices, plus the voices the platform explicitly maps per language
// (CARTESIA_FALLBACK_VOICES). Private voices of the platform account are
// never offered otherwise. Shared by the voice catalog (listing/selection)
// and the agent sync (re-validated before every push).
import type { CartesiaVoice } from './client'
import { cartesiaFallbackVoices } from '@/lib/voice-providers/config'

export const CARTESIA_VOICE_ID_RE = /^[A-Za-z0-9-]{8,64}$/

export function isPublicCartesiaVoice(v: CartesiaVoice): boolean {
  const access = typeof v.access === 'string' ? v.access : v.access?.type
  return access === 'public' || v.is_owner === false
}

export function platformFallbackIds(): Set<string> {
  return new Set(Object.values(cartesiaFallbackVoices()))
}

export function isAllowedFallbackVoice(v: CartesiaVoice, mapped: Set<string> = platformFallbackIds()): boolean {
  return CARTESIA_VOICE_ID_RE.test(v.id) && (v.status ?? 'active') === 'active' && (isPublicCartesiaVoice(v) || mapped.has(v.id))
}
