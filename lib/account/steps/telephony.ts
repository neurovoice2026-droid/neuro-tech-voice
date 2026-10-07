import 'server-only'
// release_numbers: every phone number of the organization leaves every
// provider: the native ElevenLabs import and the Cartesia SIP import are
// removed, then the Twilio number is released (that stops its cost). A number
// whose providers all confirmed (or answered "not found") is marked released
// on its row, so a resumed job does not call them again. Ids come only from
// the organization's own phone_numbers rows. An ElevenLabs import labelled
// for another organization or environment is never deleted (shared workspace).

import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import { deploymentEnv, parseImportLabel } from '@/lib/telephony/import-label'
import { maskPhone } from '@/lib/phone/e164'
import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'
import { isGone } from './util'

const TWILIO_NUMBER_SID = /^PN[0-9a-f]{32}$/i

interface NumberRow {
  id: string
  number: string | null
  twilio_sid: string | null
  elevenlabs_phone_number_id: string | null
  cartesia_phone_number_id: string | null
}

type Result = 'done' | 'gone' | 'not_configured' | 'foreign' | 'failed'

async function removeElevenLabsImport(ctx: StepContext, id: string): Promise<Result> {
  if (!el.isConfigured()) return 'not_configured'
  const reqCtx = { orgId: ctx.orgId }
  try {
    const imported = await el.phoneNumbers.get(id, reqCtx)
    const label = parseImportLabel(imported.label)
    // Labelled for another organization or another deployment's environment: never deleted.
    if (label && (label.orgId !== ctx.orgId.toLowerCase() || label.env !== deploymentEnv())) return 'foreign'
    await el.phoneNumbers.delete(id, reqCtx)
    return 'done'
  } catch (err) {
    if (isGone(err)) return 'gone'
    ctx.log.error('account_deletion.elevenlabs_import_delete_failed', err)
    return 'failed'
  }
}

async function removeCartesiaImport(ctx: StepContext, id: string): Promise<Result> {
  if (!ct.isConfigured()) return 'not_configured'
  try {
    await ct.telephony.deleteNumber(id)
    return 'done'
  } catch (err) {
    if (isGone(err)) return 'gone'
    ctx.log.error('account_deletion.cartesia_import_delete_failed', err)
    return 'failed'
  }
}

async function releaseTwilioNumber(ctx: StepContext, sid: string): Promise<Result> {
  // Placeholder rows from development ('mock…') were never bought.
  if (!TWILIO_NUMBER_SID.test(sid)) return 'gone'
  if (!isTwilioConfigured()) return 'not_configured'
  try {
    await getTwilioClient().incomingPhoneNumbers(sid).remove()
    return 'done'
  } catch (err) {
    if (isGone(err)) return 'gone'
    ctx.log.error('account_deletion.twilio_release_failed', err, { status: (err as { status?: number }).status ?? null })
    return 'failed'
  }
}

export async function releaseNumbers(ctx: StepContext): Promise<StepOutcome> {
  const { data, error } = await ctx.db
    .from('phone_numbers')
    .select('id, number, twilio_sid, elevenlabs_phone_number_id, cartesia_phone_number_id')
    .eq('org_id', ctx.orgId)
  if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
  const counts = { numbers: 0, released: 0, imports_removed: 0, already_gone: 0, foreign_skipped: 0, not_configured: 0, failed: 0 }
  for (const row of (data ?? []) as NumberRow[]) {
    counts.numbers++
    const log = ctx.log.child({ phoneNumberId: row.id, number: row.number ? maskPhone(row.number) : null })
    const results: Result[] = []
    if (row.elevenlabs_phone_number_id) results.push(await removeElevenLabsImport({ ...ctx, log }, row.elevenlabs_phone_number_id))
    if (row.cartesia_phone_number_id) results.push(await removeCartesiaImport({ ...ctx, log }, row.cartesia_phone_number_id))
    const imports = results.length
    if (row.twilio_sid) results.push(await releaseTwilioNumber({ ...ctx, log }, row.twilio_sid))
    results.forEach((r, i) => {
      if (r === 'done') {
        if (i < imports) counts.imports_removed++
        else counts.released++
      } else if (r === 'gone') counts.already_gone++
      else if (r === 'foreign') {
        counts.foreign_skipped++
        log.error('account_deletion.foreign_import_skipped', undefined)
      } else if (r === 'not_configured') {
        counts.not_configured++
        log.error('account_deletion.provider_not_configured', undefined, { area: 'phone_numbers' })
      }
    })
    if (results.includes('failed')) {
      counts.failed++
      continue
    }
    // Every provider confirmed: forget the ids so a resumed job never calls them again.
    const { error: updErr } = await ctx.db
      .from('phone_numbers')
      .update({ is_active: false, elevenlabs_phone_number_id: null, cartesia_phone_number_id: null, twilio_sid: null })
      .eq('id', row.id)
      .eq('org_id', ctx.orgId)
    if (updErr) throw new Error(`phone_numbers update failed: ${updErr.message}`)
  }
  if (counts.failed) throw new Error(`${counts.failed} phone number(s) could not be released`)
  return { status: 'done', counts }
}
