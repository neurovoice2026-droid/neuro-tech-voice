import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/http'
import { CartesiaError, cartesia } from '@/lib/cartesia/client'
import { isCartesiaConfigured } from '@/lib/env'
import { kvDel, kvGet, kvSet } from '@/lib/kv'
import { DEFAULT_CARTESIA_VOICES } from '@/lib/voice/voice-map'
import { isMissingRelationError } from '@/lib/voice/sync/db'

// Voice checks shared by the agent routes and the sync job. A voice id coming
// from the browser is only accepted when Cartesia knows it and, for cloned
// voices, when the clone belongs to this organisation: every customer's
// clones live in the same Cartesia account, so `is_owner` alone would let one
// tenant pick another tenant's cloned voice.

export type VoiceGender = 'masculine' | 'feminine' | 'gender_neutral'

export interface VoiceFacts {
  id: string
  name: string
  gender: VoiceGender | null
  is_pro: boolean
  is_owner: boolean
}

const VOICE_FACTS_TTL_SECONDS = 600

function cacheKey(voiceId: string): string {
  return `cartesia:voice-facts:${voiceId}`
}

/** Our curated default voices are known without an API call. */
export function defaultVoiceFacts(voiceId: string): VoiceFacts | null {
  for (const pair of Object.values(DEFAULT_CARTESIA_VOICES)) {
    for (const voice of [pair.feminine, pair.masculine]) {
      if (voice.voice_id === voiceId) {
        return { id: voice.voice_id, name: voice.name, gender: voice.gender, is_pro: false, is_owner: false }
      }
    }
  }
  return null
}

function isFacts(value: unknown): value is VoiceFacts {
  return !!value && typeof value === 'object' && typeof (value as VoiceFacts).id === 'string' && typeof (value as VoiceFacts).name === 'string'
}

/**
 * Voice facts from the cache or Cartesia. Returns null when Cartesia says the
 * voice doesn't exist; other failures throw (the caller decides whether that
 * blocks anything).
 */
export async function getVoiceFacts(voiceId: string): Promise<VoiceFacts | null> {
  const known = defaultVoiceFacts(voiceId)
  if (known) return known
  const cached = await kvGet<VoiceFacts>(cacheKey(voiceId))
  if (isFacts(cached)) return cached
  try {
    const voice = await cartesia.voices.get(voiceId)
    const facts: VoiceFacts = {
      id: voice.id || voiceId,
      name: voice.name || 'Custom voice',
      gender: voice.gender,
      is_pro: voice.is_pro,
      is_owner: voice.is_owner,
    }
    await kvSet(cacheKey(voiceId), facts, VOICE_FACTS_TTL_SECONDS)
    return facts
  } catch (error) {
    if (error instanceof CartesiaError && (error.status === 404 || error.errorCode === 'voice_not_found')) return null
    throw error
  }
}

/** Drops cached facts, e.g. after Cartesia reported the voice as gone. */
export async function forgetVoiceFacts(voiceId: string): Promise<void> {
  await kvDel(cacheKey(voiceId))
}

/**
 * True when another organisation cloned this voice in the app. Used when
 * Cartesia can't be asked (outage) so a pick is accepted unverified: a library
 * voice is harmless, another tenant's clone never is. Service-role client; the
 * query is explicitly scoped to organisations other than `orgId` and only
 * answers yes or no.
 */
export async function isOtherOrgClone(admin: SupabaseClient, orgId: string, voiceId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('voice_clones')
    .select('id')
    .eq('cartesia_voice_id', voiceId)
    .neq('org_id', orgId)
    .limit(1)
  if (error) {
    if (isMissingRelationError(error)) return false
    console.error('[voices]', 'clone ownership lookup failed', error.code, error.message)
    throw new ApiError(500, 'voice_lookup_failed', 'We couldn’t check that voice right now. Please try again in a moment.')
  }
  return Array.isArray(data) && data.length > 0
}

async function isOrgClone(client: SupabaseClient, orgId: string, voiceId: string): Promise<boolean> {
  const { data, error } = await client
    .from('voice_clones')
    .select('id')
    .eq('org_id', orgId)
    .eq('cartesia_voice_id', voiceId)
    .eq('status', 'ready')
    .limit(1)
    .maybeSingle()
  if (error) {
    if (isMissingRelationError(error)) return false
    console.error('[voices]', 'clone ownership lookup failed', error.code, error.message)
    throw new ApiError(500, 'voice_lookup_failed', 'We couldn’t check that voice right now. Please try again in a moment.')
  }
  return !!data
}

/**
 * Validates a voice picked in the dashboard or during onboarding (clone
 * ownership is read with the given client; the user's own RLS allows it). Throws an
 * ApiError with a message that can be shown as-is.
 */
export async function resolveSelectableVoice(client: SupabaseClient, orgId: string, voiceId: string): Promise<VoiceFacts> {
  const known = defaultVoiceFacts(voiceId)
  if (known) return known
  if (!isCartesiaConfigured()) {
    throw new ApiError(503, 'not_configured', 'Voices can’t be changed right now because the voice service isn’t set up yet.')
  }

  let facts: VoiceFacts | null
  try {
    facts = await getVoiceFacts(voiceId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('[cartesia]', 'voice lookup failed', error instanceof Error ? error.message : error)
    throw new ApiError(502, 'voice_lookup_failed', 'We couldn’t check that voice right now. Please try again in a moment.')
  }

  const notAvailable = new ApiError(400, 'voice_not_found', 'That voice isn’t available. Please pick another one.')
  if (!facts) throw notAvailable
  if (facts.is_owner && !(await isOrgClone(client, orgId, voiceId))) throw notAvailable
  return facts
}

export interface ElevenLabsVoiceChoice {
  /** The ElevenLabs twin of the owner's cloned voice, when one was made. */
  twinVoiceId: string | null
  /** Gender of the Cartesia voice when it could be learned quickly; null when unknown. */
  gender: VoiceGender | null
}

/**
 * What the ElevenLabs fallback should sound like for an agent's Cartesia
 * voice: the clone's ElevenLabs twin when there is one, otherwise a premade
 * voice of the same gender. Never throws and never waits on Cartesia longer
 * than `lookupMs` (the telephony router has to answer Twilio within seconds);
 * an unknown gender falls back to the default voice.
 */
export async function resolveElevenLabsVoice(
  admin: SupabaseClient,
  orgId: string,
  cartesiaVoiceId: string | null,
  opts: { lookupMs?: number } = {}
): Promise<ElevenLabsVoiceChoice> {
  if (!cartesiaVoiceId) return { twinVoiceId: null, gender: null }
  const known = defaultVoiceFacts(cartesiaVoiceId)
  if (known) return { twinVoiceId: null, gender: known.gender }

  try {
    const { data, error } = await admin
      .from('voice_clones')
      .select('elevenlabs_voice_id, gender')
      .eq('org_id', orgId)
      .eq('cartesia_voice_id', cartesiaVoiceId)
      .eq('status', 'ready')
      .limit(1)
      .maybeSingle()
    if (error) {
      if (!isMissingRelationError(error)) console.error('[voices]', 'clone lookup for the fallback voice failed', error.code, error.message)
    } else if (data) {
      const row = data as { elevenlabs_voice_id: string | null; gender: string | null }
      const gender = row.gender === 'masculine' || row.gender === 'feminine' || row.gender === 'gender_neutral' ? row.gender : null
      return { twinVoiceId: row.elevenlabs_voice_id?.trim() || null, gender }
    }
  } catch (error) {
    console.error('[voices]', 'clone lookup for the fallback voice failed', error instanceof Error ? error.message : error)
  }

  if (!isCartesiaConfigured()) return { twinVoiceId: null, gender: null }
  const lookupMs = opts.lookupMs ?? 800
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const facts = await Promise.race([
      getVoiceFacts(cartesiaVoiceId),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), lookupMs)
      }),
    ])
    return { twinVoiceId: null, gender: facts?.gender ?? null }
  } catch (error) {
    console.warn('[cartesia]', 'voice gender lookup failed', cartesiaVoiceId, error instanceof Error ? error.message : error)
    return { twinVoiceId: null, gender: null }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
