import 'server-only'
import { kvIncr } from '@/lib/kv'
import { notifyContacts } from '@/lib/notifications'
import { teamAlertSms } from '@/lib/sms/templates'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { failure, spokenDateTime, success, type ToolHandler } from '@/lib/voice/tools/runtime'

// notify_team: an alert that can't wait for the end of the call. It is also
// saved to the inbox, and delivery is awaited so the agent only tells the
// caller "the team has been alerted" when a text or email really went out.
// A few alerts per call at most: every one texts real people and costs money,
// and a caller can't talk the agent into paging the team over and over.

export const MAX_ALERTS_PER_CALL = 3
const COUNTER_TTL_SECONDS = 6 * 3600

export const notifyTeamTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('notify_team', args)
  if (!parsed.ok) return failure(parsed.message)
  const { summary, urgency } = parsed.data

  if ((await kvIncr(`tool:alerts:${ctx.call.id}`, COUNTER_TTL_SECONDS)) > MAX_ALERTS_PER_CALL) {
    return failure(
      "The team has already been alerted several times during this call, so no new alert was sent. Don't alert them again; tell the caller the team already knows, and take a message if there is something new to pass on."
    )
  }

  const { data: row, error } = await ctx.admin
    .from('agent_messages')
    .insert({
      org_id: ctx.org.id,
      agent_id: ctx.agent?.id ?? null,
      call_id: ctx.call.id,
      caller_number: ctx.callerPhone,
      callback_number: ctx.callerPhone,
      body: summary,
      urgency,
      status: 'new',
    })
    .select('id')
    .single()
  if (error) console.error('[tools] saving an alert failed', error.code, error.message)

  // A test call still really notifies the team (that is what the owner is
  // testing), but says so up front so nobody treats it as a real emergency.
  const isTest = ctx.call.is_test
  const result = await notifyContacts({
    orgId: ctx.org.id,
    urgency,
    subject: `${isTest ? 'Test call: ' : ''}${urgency === 'urgent' ? 'Urgent alert from a live call' : 'Alert from a live call'}`,
    body: [
      isTest ? 'This alert comes from a test call made from your dashboard.' : null,
      summary,
      '',
      `Caller's number: ${ctx.callerPhone ?? 'unknown'}`,
      `Time: ${spokenDateTime(ctx.now, ctx.timezone)} (${ctx.timezone})`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
    smsBody: teamAlertSms({
      language: ctx.language,
      businessName: ctx.businessName,
      summary: isTest ? `[TEST] ${summary}` : summary,
      callerNumber: ctx.callerPhone,
      urgency,
    }),
    callId: ctx.call.id,
    footer: 'The caller may still be on the line with your AI assistant.',
  })

  if (row && result.delivered) {
    const update = await ctx.admin
      .from('agent_messages')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('org_id', ctx.org.id)
    if (update.error) console.error('[tools] marking an alert as notified failed', update.error.code, update.error.message)
  }

  if (!result.delivered) {
    return failure(
      `The alert couldn't be delivered right now${row ? ', but it was saved for the team' : ''}. Tell the caller it has been recorded and the team will see it as soon as possible, and offer to take a message with a callback number. If anyone is in danger, tell them to call the local emergency number now.`
    )
  }
  return success(
    'The team has been alerted. Tell the caller the team knows about it now. Keep helping with anything else they need, and do not promise how quickly someone will respond.'
  )
}
