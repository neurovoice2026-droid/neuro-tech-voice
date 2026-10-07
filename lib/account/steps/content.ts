import 'server-only'
// The organization's content at ElevenLabs: knowledge base copies (slice E),
// the pronunciation dictionary (slice F) and its own custom voices.
//
// delete_voices touches only provider_voices rows OWNED by the organization
// (owner_org_id = org) that the platform created for it (cloned, designed).
// Platform-wide library voices (owner_org_id NULL) are shared by every tenant
// and are never deleted. Speech-history items rendered with a deleted voice
// are purged too (previews). Each voice is marked deleted on its row once the
// provider confirmed, so the organization's BEFORE DELETE purge queue
// (migration 015) does not queue it again.

import * as el from '@/lib/elevenlabs/client'
import { deleteAllOrgKnowledge } from '@/lib/voice-providers/knowledge-delete'
import { deleteOrgPronunciation } from '@/lib/voice-providers/pronunciation'
import { purgeVoiceHistory } from '@/lib/voice-providers/tts-history'
import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'
import { isGone, isNotConfigured } from './util'

/** Same format check as the voice catalog (lib/voice-providers/voice-catalog.ts EL_VOICE_ID_RE). */
const EL_VOICE_ID = /^[A-Za-z0-9]{8,64}$/

export async function deleteKnowledgeCopies(ctx: StepContext): Promise<StepOutcome> {
  if (!el.isConfigured()) {
    const { count, error } = await ctx.db.from('knowledge_documents').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).not('elevenlabs_doc_id', 'is', null)
    if (error) throw new Error(`knowledge_documents count failed: ${error.message}`)
    if (count) ctx.log.error('account_deletion.provider_not_configured', undefined, { area: 'knowledge', documents: count })
    return { status: 'done', counts: { not_configured: count ?? 0 } }
  }
  // Documents, website imports and the organization's folder; never throws for provider failures.
  const report = await deleteAllOrgKnowledge(ctx.orgId, ctx.log)
  if (report.failed) throw new Error(`${report.failed} knowledge item(s) could not be deleted`)
  return {
    status: 'done',
    counts: { documents: report.documents, websites: report.websites, folder: report.folder ? 1 : 0, deleted: report.deleted, already_gone: report.alreadyGone },
  }
}

export async function deletePronunciation(ctx: StepContext): Promise<StepOutcome> {
  if (!el.isConfigured()) return { status: 'done', counts: { not_configured: 1 } }
  const report = await deleteOrgPronunciation(ctx.orgId, ctx.log)
  if (report.failed) throw new Error(`${report.failed} pronunciation dictionary(ies) could not be archived`)
  return { status: 'done', counts: { archived: report.archived, already_gone: report.gone } }
}

export async function deleteVoices(ctx: StepContext): Promise<StepOutcome> {
  const { data, error } = await ctx.db
    .from('provider_voices')
    .select('id, voice_id, source, status')
    .eq('owner_org_id', ctx.orgId)
    .eq('provider', 'elevenlabs')
    .in('source', ['cloned', 'designed'])
    .neq('status', 'deleted')
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  const counts = { voices: 0, deleted: 0, already_gone: 0, history_failed: 0, not_configured: 0, failed: 0 }
  for (const row of (data ?? []) as Array<{ id: string; voice_id: string }>) {
    counts.voices++
    if (EL_VOICE_ID.test(row.voice_id)) {
      if (!el.isConfigured()) {
        counts.not_configured++
        ctx.log.error('account_deletion.provider_not_configured', undefined, { area: 'voices' })
        continue
      }
      try {
        await el.voices.delete(row.voice_id, { orgId: ctx.orgId })
        counts.deleted++
      } catch (err) {
        if (isGone(err)) counts.already_gone++
        else if (isNotConfigured(err)) {
          counts.not_configured++
          continue
        } else {
          counts.failed++
          ctx.log.error('account_deletion.voice_delete_failed', err, { voiceId: row.voice_id })
          continue
        }
      }
      // Previews rendered in this voice (speech history of the shared workspace).
      const history = await purgeVoiceHistory(row.voice_id, ctx.log)
      if (history.failed) counts.history_failed += history.failed
    }
    const { error: markErr } = await ctx.db
      .from('provider_voices')
      .update({ status: 'deleted', deleted_at: new Date(ctx.now()).toISOString() })
      .eq('id', row.id)
      .eq('owner_org_id', ctx.orgId)
    if (markErr) throw new Error(`provider_voices update failed: ${markErr.message}`)
  }
  if (counts.failed) throw new Error(`${counts.failed} custom voice(s) could not be deleted`)
  if (counts.history_failed) ctx.log.warn('account_deletion.voice_history_incomplete', { items: counts.history_failed })
  return { status: 'done', counts }
}
