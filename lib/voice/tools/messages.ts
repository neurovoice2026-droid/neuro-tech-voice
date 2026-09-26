import 'server-only'
import { kvIncr } from '@/lib/kv'
import { normalizeE164 } from '@/lib/phone/e164'
import { notifyContacts } from '@/lib/notifications'
import { messageReceivedSms } from '@/lib/sms/templates'
import { findContact } from '@/lib/voice/tools/contacts'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import {
  failure,
  lastFour,
  loadContacts,
  spokenDateTime,
  success,
  type ToolContact,
  type ToolContext,
  type ToolHandler,
} from '@/lib/voice/tools/runtime'
import type { MessageUrgency } from '@/types'

// take_message: saves the message to the inbox first (so it exists even if
// every notification fails), then tells the team in the background. Beyond a
// few messages per call the rest still reach the inbox, without more texts
// and emails to the team.

export const MAX_NOTIFIED_MESSAGES_PER_CALL = 5
const COUNTER_TTL_SECONDS = 6 * 3600

/** "0712 345 678" can't be normalised without a country; keep what the caller said, readable. */
function callbackNumber(raw: string | null, fallback: string | null): string | null {
  if (!raw) return fallback
  const e164 = normalizeE164(raw)
  if (e164) return e164
  const cleaned = raw.replace(/[^\d+()\s-]/g, '').replace(/\s+/g, ' ').trim()
  return cleaned.replace(/\D/g, '').length >= 6 ? cleaned.slice(0, 32) : fallback
}

export async function notifyAboutMessage(
  ctx: ToolContext,
  message: {
    id: string
    body: string
    urgency: MessageUrgency
    callerName: string | null
    callbackNumber: string | null
    recipient: ToolContact | null
    recipientName: string | null
  }
): Promise<boolean> {
  const who = message.callerName || 'A caller'
  const isTest = ctx.call.is_test
  const lines = [
    isTest ? 'This message comes from a test call made from your dashboard.' : null,
    `${who} left a message with your AI phone assistant.`,
    '',
    message.body,
    '',
    `Caller: ${message.callerName || 'not given'}`,
    `Call back on: ${message.callbackNumber || 'not given'}`,
    message.recipient || message.recipientName ? `For: ${message.recipient?.name ?? message.recipientName}` : null,
    `Urgency: ${message.urgency === 'urgent' ? 'urgent' : 'normal'}`,
    `Received: ${spokenDateTime(ctx.now, ctx.timezone)} (${ctx.timezone})`,
  ].filter((line): line is string => line !== null)

  const result = await notifyContacts({
    orgId: ctx.org.id,
    urgency: message.urgency,
    subject: `${isTest ? 'Test call: ' : ''}New message from ${message.callerName || 'a caller'}`,
    body: lines.join('\n'),
    smsBody: messageReceivedSms({
      language: ctx.language,
      businessName: ctx.businessName,
      callerName: message.callerName,
      callbackNumber: message.callbackNumber,
      message: isTest ? `[TEST] ${message.body}` : message.body,
      urgency: message.urgency,
    }),
    contactIds: message.recipient ? [message.recipient.id] : null,
    callId: ctx.call.id,
    footer: 'This message is also in the Inbox of your dashboard.',
  })
  if (result.delivered) {
    const { error } = await ctx.admin
      .from('agent_messages')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', message.id)
      .eq('org_id', ctx.org.id)
      .eq('status', 'new')
    if (error) console.error('[tools] marking a message as notified failed', error.code, error.message)
  }
  return result.delivered
}

export const takeMessageTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('take_message', args)
  if (!parsed.ok) return failure(parsed.message)
  const data = parsed.data

  let contacts: ToolContact[] = []
  try {
    contacts = await loadContacts(ctx)
  } catch {
    // The message still gets saved and reaches the owner.
  }
  const recipient = data.recipient ? findContact(contacts, data.recipient) : null
  const callback = callbackNumber(data.callback_number, ctx.callerPhone)

  const { data: row, error } = await ctx.admin
    .from('agent_messages')
    .insert({
      org_id: ctx.org.id,
      agent_id: ctx.agent?.id ?? null,
      call_id: ctx.call.id,
      recipient_contact_id: recipient?.id ?? null,
      recipient_name: recipient?.name ?? data.recipient,
      caller_name: data.caller_name,
      caller_number: ctx.callerPhone,
      callback_number: callback,
      body: data.message,
      urgency: data.urgency,
      status: 'new',
    })
    .select('id')
    .single()
  if (error || !row) {
    console.error('[tools] saving a message failed', error?.code, error?.message)
    return failure(
      "The message couldn't be saved. Apologise, and ask the caller to call back a little later or to try another way of reaching the business."
    )
  }

  const messageId = row.id as string
  let notifying = false
  try {
    notifying = (await kvIncr(`tool:messages:${ctx.call.id}`, COUNTER_TTL_SECONDS)) <= MAX_NOTIFIED_MESSAGES_PER_CALL
  } catch (error) {
    // Without the counter, notifying is the safer side: the caller was promised a callback.
    console.error('[tools] message counter failed', error instanceof Error ? error.message : error)
    notifying = true
  }
  if (notifying) {
    ctx.defer(() =>
      notifyAboutMessage(ctx, {
        id: messageId,
        body: data.message,
        urgency: data.urgency,
        callerName: data.caller_name,
        callbackNumber: callback,
        recipient,
        recipientName: data.recipient,
      })
    )
  } else {
    console.warn('[tools] message saved without notifying: per-call limit reached', { callId: ctx.call.id })
  }

  const forWhom = recipient ? ` for ${recipient.name}` : data.recipient ? ` for ${data.recipient}` : ''
  const ending = callback ? lastFour(callback) : null
  const delivery = notifying ? 'the team is being notified now' : 'the team will see it in their inbox'
  return success(
    `Message saved${forWhom}${data.urgency === 'urgent' ? ' and marked urgent' : ''}; ${delivery}. Tell the caller their message has been passed on${ending ? ` and they will be called back on the number ending in ${ending}` : ''}. Don't promise a specific time for the callback.`
  )
}
