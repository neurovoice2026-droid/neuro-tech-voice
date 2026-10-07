import 'server-only'
// take_message: saves the caller's message on the call (call_messages, one
// per call; a second call corrects it), then alerts the team by e-mail after
// the answer (so a slow mail provider never delays the caller). The message
// exists even if every alert fails, and appears in the dashboard's
// "Messages to follow up". Ported from the handler logic of commit e7c7974
// (lib/voice/tools/messages.ts), adapted to one message per call, the
// platform e-mail client and per-call idempotency.

import type { Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import type { ToolCallContext } from './call-context'
import { lastFour, normalizeCallbackNumber } from './call-context'
import { claimInvocation, completeInvocation, IN_PROGRESS_MESSAGE, invocationKey, releaseInvocation, type ToolAnswer } from './invocations'
import { notifyMessageTaken } from './notify'
import { parseToolArguments } from './schemas'

const MESSAGES_OFF =
  'Taking messages is not available on this call. Repeat the caller’s name, number and reason back to them and tell them the team will call back.'
const SAVE_FAILED =
  "The message couldn't be saved right now. Repeat the details back to the caller (they are kept in the call record) and tell them the team will call back."

type MessageRow = {
  id: string
  caller_name: string | null
  callback_number: string | null
  reason: string
  urgency: 'normal' | 'urgent'
  notify_count: number
}

const MESSAGE_COLUMNS = 'id, caller_name, callback_number, reason, urgency, notify_count'

async function existingMessage(ctx: ToolCallContext, log: Logger): Promise<MessageRow | null | 'error'> {
  const { data, error } = await ctx.db.from('call_messages').select(MESSAGE_COLUMNS).eq('call_id', ctx.call.id).eq('org_id', ctx.org.id).maybeSingle()
  if (error) {
    log.error('tools.message_read_failed', error)
    return 'error'
  }
  return (data as MessageRow | null) ?? null
}

export async function takeMessageTool(ctx: ToolCallContext, args: unknown, log: Logger, provider: 'elevenlabs' | 'cartesia'): Promise<ToolAnswer> {
  if (!ctx.agent.messages.enabled) return { ok: false, message: MESSAGES_OFF }
  const parsed = parseToolArguments('take_message', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }

  // The callback number defaults to the caller's own number from the call row
  // (the same value as {{system__caller_id}}); a dictated one is normalized.
  const record = {
    caller_name: parsed.data.caller_name,
    callback_number: normalizeCallbackNumber(parsed.data.callback_number, ctx.businessPhone) ?? ctx.callerPhone,
    reason: parsed.data.reason,
    urgency: parsed.data.urgency,
  }

  const claim = await claimInvocation(ctx.db, { orgId: ctx.org.id, callId: ctx.call.id, tool: 'take_message', key: invocationKey(record) }, log, ctx.now.getTime())
  if (claim.kind === 'replay') return claim.answer
  if (claim.kind === 'in_progress') return { ok: false, message: IN_PROGRESS_MESSAGE }

  let row = await existingMessage(ctx, log)
  let created = false
  let changed = false
  if (row === 'error') {
    await releaseInvocation(ctx.db, claim, log)
    return { ok: false, message: SAVE_FAILED }
  }
  if (!row) {
    const { data, error } = await ctx.db
      .from('call_messages')
      .insert({ ...record, org_id: ctx.org.id, agent_id: ctx.agent.id, call_id: ctx.call.id, provider, status: 'open', notify_count: 0 })
      .select(MESSAGE_COLUMNS)
      .single()
    if (!error && data) {
      row = data as MessageRow
      created = true
    } else if (error?.code === '23505') {
      // A parallel take_message on the same call inserted first: correct that one.
      const again = await existingMessage(ctx, log)
      row = again === 'error' ? null : again
    }
    if (!row) {
      if (error?.code !== '23505') log.error('tools.message_insert_failed', error)
      await releaseInvocation(ctx.db, claim, log)
      return { ok: false, message: SAVE_FAILED }
    }
  }
  if (!created) {
    const current = row
    const same =
      current.caller_name === record.caller_name &&
      current.callback_number === record.callback_number &&
      current.reason === record.reason &&
      current.urgency === record.urgency
    if (!same) {
      const { error } = await ctx.db
        .from('call_messages')
        // A correction re-opens the follow-up.
        .update({ ...record, status: 'open', done_at: null })
        .eq('id', current.id)
        .eq('org_id', ctx.org.id)
      if (error) {
        log.error('tools.message_update_failed', error)
        await releaseInvocation(ctx.db, claim, log)
        return { ok: false, message: SAVE_FAILED }
      }
      changed = true
    }
  }

  if (created || changed) {
    const alert = {
      id: row.id,
      callerName: record.caller_name,
      callbackNumber: record.callback_number,
      reason: record.reason,
      urgency: record.urgency,
      notifyCount: row.notify_count ?? 0,
      updated: changed,
    }
    deferBackground(
      notifyMessageTaken(ctx, alert, log).catch((err: unknown) => {
        log.error('message_alert.failed', err)
        return 'failed' as const
      }),
    )
  }

  const ending = lastFour(record.callback_number)
  const verb = created ? 'Message saved' : changed ? 'Message updated' : 'This message was already saved'
  const answer: ToolAnswer = {
    ok: true,
    message: `${verb}${record.urgency === 'urgent' ? ' and marked urgent' : ''}. Tell the caller it has been passed on to the team${
      ending ? ` and that they will be called back on the number ending in ${ending}` : ''
    }. Do not promise a time for the callback.`,
  }
  await completeInvocation(ctx.db, claim, answer, log)
  log.info('tools.message_taken', { created, changed, urgent: record.urgency === 'urgent', provider })
  return answer
}
