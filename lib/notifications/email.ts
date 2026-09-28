// Notification email bodies: the same content as plain text and as escaped
// HTML (every value from a caller or the model is escaped). Pure.

export interface NotificationEmailInput {
  subject: string
  /** Plain text; line breaks are kept. */
  body: string
  businessName: string | null
  urgent: boolean
  /** Short line under the body, e.g. where to find the message. */
  footer?: string | null
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Subject lines can't carry line breaks (header injection) and stay short. */
export function emailSubject(subject: string, urgent: boolean): string {
  const clean = subject.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
  return urgent && !/^urgent\b/i.test(clean) ? `Urgent: ${clean}` : clean
}

export function notificationEmailText(input: NotificationEmailInput): string {
  return [input.businessName ? `${input.businessName}` : null, input.body.trim(), input.footer?.trim() || null]
    .filter((part): part is string => !!part)
    .join('\n\n')
}

export function notificationEmailHtml(input: NotificationEmailInput): string {
  const accent = input.urgent ? '#b91c1c' : '#7c3aed'
  const label = input.urgent ? 'Urgent' : 'New'
  const business = input.businessName ? escapeHtml(input.businessName) : ''
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="border-top:4px solid ${accent};padding:24px 28px 8px">
          <span style="display:inline-block;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${accent}">${label}</span>
          ${business ? `<span style="font-size:12px;color:#6b7280"> · ${business}</span>` : ''}
          <h1 style="margin:10px 0 0;font-size:19px;line-height:1.35;color:#111827">${escapeHtml(input.subject)}</h1>
        </td></tr>
        <tr><td style="padding:12px 28px 24px">
          <div style="font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap">${escapeHtml(input.body.trim())}</div>
          ${input.footer ? `<p style="margin:18px 0 0;font-size:13px;color:#6b7280">${escapeHtml(input.footer)}</p>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
