// Team contacts the agent can transfer to or alert (escalation_contacts).
// The rules live in ./validate (no zod, so the dashboard form can use them
// without shipping the validation library); the API parses request bodies
// through this zod wrapper, so both reject the same input with the same words.

import '@/lib/zod-setup'
import { z } from 'zod'
import { contactIssueMessages, validateContactInput, type ContactInput } from './validate'

export type { ContactInput } from './validate'

export const MAX_CONTACTS = 25

export const contactInputSchema = z.unknown().transform((value, ctx): ContactInput => {
  const result = validateContactInput(value)
  if (result.success) return result.data
  for (const issue of result.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  return z.NEVER
})

/** Columns returned to the dashboard (every EscalationContact field). */
export const CONTACT_COLUMNS =
  'id, org_id, name, role, phone, email, transfer_enabled, notify_sms, notify_email, is_on_call, conditions, sort_order, created_at'

/** First error message per field, for inline form errors. */
export function contactFieldErrors(error: z.ZodError): Partial<Record<keyof ContactInput, string>> {
  return contactIssueMessages(error.issues)
}
