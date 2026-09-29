// Tab ids for the inbox, shared by the server page (?tab=) and the client.

export const INBOX_TABS = ['messages', 'bookings', 'waitlist'] as const
export type InboxTab = (typeof INBOX_TABS)[number]

export function parseInboxTab(value: unknown): InboxTab {
  const raw = Array.isArray(value) ? value[0] : value
  return INBOX_TABS.find((tab) => tab === raw) ?? 'messages'
}
