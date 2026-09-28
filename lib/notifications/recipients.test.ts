import { describe, expect, it } from 'vitest'
import { channelsFor, selectNotificationRecipients, type NotifiableContact } from '@/lib/notifications/recipients'
import { emailSubject, escapeHtml, notificationEmailHtml, notificationEmailText } from '@/lib/notifications/email'

function contact(overrides: Partial<NotifiableContact> & { id: string }): NotifiableContact {
  return {
    name: overrides.id,
    role: null,
    phone: '+40712345678',
    email: `${overrides.id}@example.com`,
    notify_sms: false,
    notify_email: true,
    is_on_call: false,
    sort_order: 0,
    ...overrides,
  }
}

describe('channelsFor', () => {
  it('uses only enabled channels with valid destinations', () => {
    expect(channelsFor(contact({ id: 'a', notify_sms: true }))).toEqual(['sms', 'email'])
    expect(channelsFor(contact({ id: 'b', notify_sms: true, phone: '0712345678' }))).toEqual(['email'])
    expect(channelsFor(contact({ id: 'c', notify_email: true, email: 'not-an-email' }))).toEqual([])
  })
})

describe('selectNotificationRecipients', () => {
  const team = [
    contact({ id: 'owner', sort_order: 2 }),
    contact({ id: 'oncall', is_on_call: true, notify_sms: true, sort_order: 1 }),
    contact({ id: 'silent', notify_email: false, notify_sms: false, sort_order: 0 }),
  ]

  it('prefers on-call contacts', () => {
    expect(selectNotificationRecipients(team, { urgency: 'normal' }).map((r) => r.contact.id)).toEqual(['oncall'])
  })

  it('uses everyone reachable when nobody is on call, in list order', () => {
    const nobodyOnCall = team.map((c) => ({ ...c, is_on_call: false }))
    expect(selectNotificationRecipients(nobodyOnCall, { urgency: 'urgent' }).map((r) => r.contact.id)).toEqual(['oncall', 'owner'])
  })

  it('sends to the named contact, adding on-call people for urgent messages', () => {
    expect(selectNotificationRecipients(team, { urgency: 'normal', contactIds: ['owner'] }).map((r) => r.contact.id)).toEqual(['owner'])
    expect(selectNotificationRecipients(team, { urgency: 'urgent', contactIds: ['owner'] }).map((r) => r.contact.id)).toEqual(['owner', 'oncall'])
  })

  it('falls back to default routing when the named contact cannot be reached', () => {
    expect(selectNotificationRecipients(team, { urgency: 'normal', contactIds: ['silent'] }).map((r) => r.contact.id)).toEqual(['oncall'])
  })

  it('returns nobody when no contact can be reached (the owner email takes over)', () => {
    expect(selectNotificationRecipients([contact({ id: 'x', notify_email: false })], { urgency: 'urgent' })).toEqual([])
    expect(selectNotificationRecipients([], { urgency: 'normal' })).toEqual([])
  })
})

describe('notification email', () => {
  it('escapes every caller-provided value', () => {
    const html = notificationEmailHtml({
      subject: 'New message from <script>alert(1)</script>',
      body: 'Call me "now" & <b>fast</b>',
      businessName: "O'Brien & Co",
      urgent: true,
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Call me &quot;now&quot; &amp; &lt;b&gt;fast&lt;/b&gt;')
    expect(html).toContain('O&#39;Brien &amp; Co')
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('keeps subjects on one line and marks urgent ones', () => {
    expect(emailSubject('New message\r\nBcc: attacker@example.com', true)).toBe('Urgent: New message Bcc: attacker@example.com')
    expect(emailSubject('Urgent alert from a live call', true)).toBe('Urgent alert from a live call')
  })

  it('has a plain-text version', () => {
    expect(notificationEmailText({ subject: 's', body: 'Line 1\nLine 2', businessName: 'Acme', urgent: false, footer: 'See inbox' })).toBe(
      'Acme\n\nLine 1\nLine 2\n\nSee inbox'
    )
  })
})
