import 'server-only'
// POST /api/telephony/twilio/whisper?t= — Twilio fetched the <Number url> of
// a transfer leg: the human answered. The call id comes from the signed
// 'whisper' token only. Fast (two primary-key reads, no provider call) and it
// never fails the transfer: any problem gives an empty document, so Twilio
// simply bridges the caller.

import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { whisperResponse } from './twiml'
import { whisperText } from './whisper'

export async function handleWhisper(callId: string, log: Logger): Promise<string> {
  try {
    const db = createAdminClient()
    const { data: call, error } = await db.from('calls').select('id, org_id, agent_id, routing').eq('id', callId).maybeSingle()
    if (error) throw new Error(`calls read failed: ${error.message}`)
    if (!call) return whisperResponse(null, 'en')
    let language = 'en'
    if (call.agent_id) {
      const { data: agent, error: agentErr } = await db.from('agents').select('language').eq('id', call.agent_id).eq('org_id', call.org_id).maybeSingle()
      if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
      language = normalizeAgentLanguage((agent?.language as string | null) ?? null)
    }
    const transfer = (call.routing as { transfer?: { reason?: unknown } } | null)?.transfer
    log.info('router.transfer_whisper', { callId, hasReason: typeof transfer?.reason === 'string' && transfer.reason.length > 0 })
    return whisperResponse(whisperText(language, transfer?.reason), language)
  } catch (err) {
    log.error('router.transfer_whisper_failed', err, { callId })
    return whisperResponse(null, 'en')
  }
}
