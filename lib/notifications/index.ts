import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { isConfigured as isEmailConfigured, sendEmail } from '@/lib/email/client'
import { sendSms } from '@/lib/twilio/sms'
import { SMS_MAX_LENGTH, sanitizeSmsText } from '@/lib/sms/templates'
import { emailSubject, notificationEmailHtml, notificationEmailText } from '@/lib/notifications/email'
import { isDeliverableEmail, selectNotificationRecipients, type NotifiableContact } from '@/lib/notifications/recipients'
import type { MessageUrgency } from '@/types'

// Tells the business's team about something the agent handled: a message a
// caller left, or an alert that can't wait. Texts go to contacts with SMS
// notifications on, emails to contacts with email on. When no contact can be
// reached (none set up, or every send failed) the account owner gets the
// email, so nothing the agent promised a caller is silently dropped.

export interface NotifyContactsInput {
  orgId: string
  urgency: MessageUrgency
  /** Email subject and first line. */
  subject: string
  /** Plain text body; values are escaped for the HTML email. */
  body: string
  /** Text message (≤ 320 characters, lib/sms/templates). Defaults to subject + body, shortened. */
  smsBody?: string | null
  /** Specific contacts (e.g. the person a message is for); others are used when they can't be reached. */
  contactIds?: string[] | null
  callId?: string | null
  /** Shown under the email body. */
  footer?: string | null
}

export interface NotifyContactsResult {
  /** At least one text or email was accepted for delivery. */
  delivered: boolean
  smsSent: number
  emailsSent: number
  failures: number
  notifiedContactIds: string[]
  /** The owner's email was used because no contact could be reached. */
  ownerFallback: boolean
}

const CONTACT_COLUMNS = 'id, name, role, phone, email, notify_sms, notify_email, is_on_call, sort_order'

function defaultSmsBody(subject: string, body: string): string {
  const text = sanitizeSmsText(`${subject}: ${body}`)
  const chars = Array.from(text)
  return chars.length <= SMS_MAX_LENGTH ? text : `${chars.slice(0, SMS_MAX_LENGTH - 1).join('').trimEnd()}…`
}

async function loadContacts(orgId: string): Promise<NotifiableContact[]> {
  const { data, error } = await createAdminClient()
    .from('escalation_contacts')
    .select(CONTACT_COLUMNS)
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
    .limit(50)
  if (error) {
    console.error('[notifications] contact lookup failed', error.code, error.message)
    return []
  }
  return (data ?? []) as NotifiableContact[]
}

async function loadOrganization(orgId: string): Promise<{ userId: string | null; businessName: string | null }> {
  const { data, error } = await createAdminClient().from('organizations').select('user_id, name').eq('id', orgId).maybeSingle()
  if (error) console.error('[notifications] organization lookup failed', error.code, error.message)
  return { userId: (data?.user_id as string | undefined) ?? null, businessName: (data?.name as string | null | undefined) ?? null }
}

/** The account owner's sign-in email, only needed when no contact could be reached. */
async function ownerEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
  if (error) console.error('[notifications] owner lookup failed', error.message)
  const email = data?.user?.email ?? null
  return isDeliverableEmail(email) ? email : null
}

export async function notifyContacts(input: NotifyContactsInput): Promise<NotifyContactsResult> {
  const result: NotifyContactsResult = {
    delivered: false,
    smsSent: 0,
    emailsSent: 0,
    failures: 0,
    notifiedContactIds: [],
    ownerFallback: false,
  }
  if (!isSupabaseAdminConfigured()) {
    console.error('[notifications] cannot notify: Supabase service role is not configured')
    return result
  }

  const urgent = input.urgency === 'urgent'
  const subject = emailSubject(input.subject, urgent)
  const smsBody = input.smsBody?.trim() || defaultSmsBody(subject, input.body)
  const emailHtml = (businessName: string | null) =>
    notificationEmailHtml({ subject, body: input.body, businessName, urgent, footer: input.footer ?? null })
  const emailText = (businessName: string | null) =>
    notificationEmailText({ subject, body: input.body, businessName, urgent, footer: input.footer ?? null })

  const [contacts, org] = await Promise.all([
    loadContacts(input.orgId),
    loadOrganization(input.orgId).catch((error: unknown) => {
      console.error('[notifications] organization lookup failed', error instanceof Error ? error.message : error)
      return { userId: null, businessName: null }
    }),
  ])
  const recipients = selectNotificationRecipients(contacts, { urgency: input.urgency, contactIds: input.contactIds })

  const sends = recipients.flatMap((recipient) =>
    recipient.channels.map(async (channel) => {
      try {
        if (channel === 'sms') {
          const sent = await sendSms({
            orgId: input.orgId,
            to: recipient.contact.phone as string,
            body: smsBody,
            kind: 'notification',
            callId: input.callId ?? null,
          })
          if (!sent.ok) {
            console.warn('[notifications] text not sent', { orgId: input.orgId, reason: sent.reason })
            return { ok: false, channel, contactId: recipient.contact.id }
          }
          return { ok: true, channel, contactId: recipient.contact.id }
        }
        const ok = await sendEmail({
          to: recipient.contact.email as string,
          subject,
          html: emailHtml(org.businessName),
          text: emailText(org.businessName),
        })
        return { ok, channel, contactId: recipient.contact.id }
      } catch (error) {
        console.error('[notifications] send failed', channel, error instanceof Error ? error.message : error)
        return { ok: false, channel, contactId: recipient.contact.id }
      }
    })
  )

  for (const outcome of await Promise.all(sends)) {
    if (!outcome.ok) {
      result.failures += 1
      continue
    }
    if (outcome.channel === 'sms') result.smsSent += 1
    else result.emailsSent += 1
    if (!result.notifiedContactIds.includes(outcome.contactId)) result.notifiedContactIds.push(outcome.contactId)
  }

  if (result.smsSent + result.emailsSent === 0) {
    const owner = isEmailConfigured()
      ? await ownerEmail(org.userId).catch((error: unknown) => {
          console.error('[notifications] owner lookup failed', error instanceof Error ? error.message : error)
          return null
        })
      : null
    if (owner) {
      const ok = await sendEmail({ to: owner, subject, html: emailHtml(org.businessName), text: emailText(org.businessName) })
      if (ok) {
        result.emailsSent += 1
        result.ownerFallback = true
      } else {
        result.failures += 1
      }
    } else {
      console.error('[notifications] nobody could be notified', {
        orgId: input.orgId,
        contacts: contacts.length,
        emailConfigured: isEmailConfigured(),
      })
    }
  }

  result.delivered = result.smsSent + result.emailsSent > 0
  return result
}
