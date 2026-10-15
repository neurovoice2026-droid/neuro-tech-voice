import 'server-only'
// Releases a bought number once nobody pays for it any more (its phone-number
// subscription ended: cancelled in the Customer Portal, or by Stripe after
// repeated failed payments). Same steps as account deletion
// (lib/account/steps/telephony.ts): the native ElevenLabs import and the
// Cartesia SIP import are removed, then the Twilio number is released, which
// is what stops its monthly cost. Then the row is deleted, as when the owner
// releases the number from the dashboard (DELETE /api/phone/[id]): calls keep
// their history (calls.phone_number_id is ON DELETE SET NULL), and the number
// can be bought again later (phone_numbers.number is UNIQUE, and
// provisionPhoneNumber treats an existing row as already bought), so a
// repeated event finds nothing left to do. When a provider fails, the row
// stays inactive with its ids and the error is thrown: the caller's retry
// (Stripe re-delivers the event for up to 3 days) finishes the job, and after
// that the row stays flagged (inactive, twilio_sid still set) for a human.

import type { SupabaseClient } from '@supabase/supabase-js'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import { deploymentEnv, parseImportLabel } from '@/lib/telephony/import-label'
import { isGone } from '@/lib/account/steps/util'
import type { Logger } from '@/lib/observability/logger'

const TWILIO_NUMBER_SID = /^PN[0-9a-f]{32}$/i

/** The phone_numbers columns releaseNumberEverywhere needs. */
export const RELEASABLE_NUMBER_COLUMNS = 'id, org_id, number, is_active, twilio_sid, elevenlabs_phone_number_id, cartesia_phone_number_id'

export interface ReleasableNumber {
  id: string
  org_id: string
  number: string
  is_active: boolean | null
  twilio_sid: string | null
  elevenlabs_phone_number_id: string | null
  cartesia_phone_number_id: string | null
}

type Outcome = 'done' | 'gone' | 'foreign' | 'not_configured' | 'failed'

async function removeElevenLabsImport(row: ReleasableNumber, id: string, log: Logger): Promise<Outcome> {
  if (!el.isConfigured()) return 'not_configured'
  const ctx = { orgId: row.org_id }
  try {
    const imported = await el.phoneNumbers.get(id, ctx)
    const label = parseImportLabel(imported.label)
    // Labelled for another organization or another deployment's environment: never deleted (shared workspace).
    if (label && (label.orgId !== row.org_id.toLowerCase() || label.env !== deploymentEnv())) return 'foreign'
    await el.phoneNumbers.delete(id, ctx)
    return 'done'
  } catch (err) {
    if (isGone(err)) return 'gone'
    log.error('phone.release_elevenlabs_failed', err)
    return 'failed'
  }
}

async function removeCartesiaImport(id: string, log: Logger): Promise<Outcome> {
  if (!ct.isConfigured()) return 'not_configured'
  try {
    await ct.telephony.deleteNumber(id)
    return 'done'
  } catch (err) {
    if (isGone(err)) return 'gone'
    log.error('phone.release_cartesia_failed', err)
    return 'failed'
  }
}

async function releaseTwilioNumber(sid: string, log: Logger): Promise<Outcome> {
  // Placeholder rows from development ('mock…') were never bought.
  if (!TWILIO_NUMBER_SID.test(sid)) return 'gone'
  if (!isTwilioConfigured()) return 'not_configured'
  try {
    await getTwilioClient().incomingPhoneNumbers(sid).remove()
    return 'done'
  } catch (err) {
    if (isGone(err)) return 'gone'
    log.error('phone.release_twilio_failed', undefined, { status: (err as { status?: number }).status ?? null })
    return 'failed'
  }
}

/**
 * Releases `row` at every provider, then deletes it. Idempotent: a provider
 * that no longer has the resource counts as done, and a deleted row is not
 * found again. Throws when the database refuses a write or a provider could
 * not confirm the removal; the Twilio number counts even when Twilio is not
 * configured here (it keeps costing money), a missing ElevenLabs or Cartesia
 * key does not (a dangling import costs nothing; logged).
 */
export async function releaseNumberEverywhere(
  db: SupabaseClient,
  row: ReleasableNumber,
  log: Logger,
): Promise<void> {
  // Inactive first: no call is routed to it from now on, whatever happens next.
  if (row.is_active !== false) {
    const { error } = await db.from('phone_numbers').update({ is_active: false }).eq('id', row.id).eq('org_id', row.org_id)
    if (error) throw new Error(`phone_numbers deactivate failed: ${error.message}`)
  }

  const results: Array<[string, Outcome]> = []
  if (row.elevenlabs_phone_number_id) results.push(['elevenlabs', await removeElevenLabsImport(row, row.elevenlabs_phone_number_id, log)])
  if (row.cartesia_phone_number_id) results.push(['cartesia', await removeCartesiaImport(row.cartesia_phone_number_id, log)])
  if (row.twilio_sid) results.push(['twilio', await releaseTwilioNumber(row.twilio_sid, log)])

  for (const [provider, outcome] of results) {
    if (outcome === 'foreign') log.error('phone.release_foreign_import_skipped', undefined, { provider })
    else if (outcome === 'not_configured') log.error('phone.release_provider_not_configured', undefined, { provider })
  }
  const unfinished = results
    .filter(([provider, outcome]) => outcome === 'failed' || (provider === 'twilio' && outcome === 'not_configured'))
    .map(([provider]) => provider)
  if (unfinished.length > 0) throw new Error(`phone number release incomplete: ${unfinished.join(', ')}`)

  // Every provider confirmed: the row goes. A row kept here would hold the
  // number, and buying it again would find it and buy nothing.
  const { error } = await db.from('phone_numbers').delete().eq('id', row.id).eq('org_id', row.org_id)
  if (error) throw new Error(`phone_numbers delete failed: ${error.message}`)
}
