// Who hears about a message or an alert from the agent. Pure.
//
// Order of preference:
// 1. the contacts the caller asked for (contactIds), if any of them can be reached
// 2. the on-call contacts that can be reached
// 3. every contact that can be reached
// 4. nobody here: the caller falls back to the account owner's email, so a
//    message is never silently dropped

import type { EscalationContact, MessageUrgency } from '@/types'
import { isE164 } from '@/lib/phone/e164'

export type NotificationChannel = 'sms' | 'email'

export type NotifiableContact = Pick<
  EscalationContact,
  'id' | 'name' | 'role' | 'phone' | 'email' | 'notify_sms' | 'notify_email' | 'is_on_call' | 'sort_order'
>

export interface NotificationRecipient {
  contact: NotifiableContact
  channels: NotificationChannel[]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isDeliverableEmail(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length <= 320 && EMAIL.test(value.trim())
}

export function channelsFor(contact: NotifiableContact): NotificationChannel[] {
  const channels: NotificationChannel[] = []
  if (contact.notify_sms && contact.phone && isE164(contact.phone)) channels.push('sms')
  if (contact.notify_email && isDeliverableEmail(contact.email)) channels.push('email')
  return channels
}

function reachable(contacts: readonly NotifiableContact[]): NotificationRecipient[] {
  return [...contacts]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((contact) => ({ contact, channels: channelsFor(contact) }))
    .filter((recipient) => recipient.channels.length > 0)
}

export function selectNotificationRecipients(
  contacts: readonly NotifiableContact[],
  opts: { urgency: MessageUrgency; contactIds?: readonly string[] | null }
): NotificationRecipient[] {
  if (opts.contactIds && opts.contactIds.length > 0) {
    const wanted = new Set(opts.contactIds)
    const chosen = reachable(contacts.filter((c) => wanted.has(c.id)))
    // An urgent alert also reaches whoever is on call, even when it names someone.
    if (chosen.length > 0 && opts.urgency !== 'urgent') return chosen
    if (chosen.length > 0) {
      const onCall = reachable(contacts.filter((c) => c.is_on_call && !wanted.has(c.id)))
      return [...chosen, ...onCall]
    }
  }
  const all = reachable(contacts)
  const onCall = all.filter((recipient) => recipient.contact.is_on_call)
  return onCall.length > 0 ? onCall : all
}
