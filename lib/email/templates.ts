// ─── Transactional email templates ───────────────────────────────────────────
// Each builder returns { subject, html }. Inline styles only (email clients
// don't support <style>/external CSS reliably).

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Neuro Tech Voice'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const BRAND = '#7c3aed'

export interface EmailContent {
  subject: string
  html: string
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  )
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">${esc(label)}</a>`
}

/** Wrap body content in the branded shell. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="background:${BRAND};padding:20px 28px">
          <span style="color:#ffffff;font-size:18px;font-weight:700">${esc(APP_NAME)}</span>
        </td></tr>
        <tr><td style="padding:32px 28px">
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${esc(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #eef0f3">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            ${esc(APP_NAME)} · <a href="${APP_URL}" style="color:#9ca3af">${esc(APP_URL.replace(/^https?:\/\//, ''))}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${text}</p>`
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export function welcomeEmail(params: { name?: string; agentName?: string }): EmailContent {
  const greeting = params.name ? `Hi ${esc(params.name)},` : 'Welcome!'
  const agent = params.agentName ? `<strong>${esc(params.agentName)}</strong>` : 'Your AI voice agent'
  return {
    subject: `Welcome to ${APP_NAME} 🎉`,
    html: layout('You’re all set!', [
      p(greeting),
      p(`${agent} is configured and ready to take calls. You can manage everything from your dashboard — review calls, tweak your agent, and set up automations.`),
      `<div style="margin:24px 0">${button(`${APP_URL}/dashboard`, 'Open dashboard')}</div>`,
      p('Need a hand getting started? Just reply to this email.'),
    ].join('')),
  }
}

// ─── Payment succeeded ────────────────────────────────────────────────────────

export function paymentSuccessEmail(params: {
  amount: number
  currency: string
  planName?: string
  invoiceNumber?: string | null
  invoiceUrl?: string | null
}): EmailContent {
  const amount = `${params.amount.toFixed(2)} ${params.currency.toUpperCase()}`
  const rows = [
    p(`We’ve received your payment of <strong>${amount}</strong>${params.planName ? ` for the <strong>${esc(params.planName)}</strong> plan` : ''}. Thank you!`),
  ]
  if (params.invoiceNumber) {
    rows.push(p(`Your fiscal invoice <strong>${esc(params.invoiceNumber)}</strong> has been issued.`))
  }
  if (params.invoiceUrl) {
    rows.push(`<div style="margin:24px 0">${button(params.invoiceUrl, 'View invoice')}</div>`)
  } else {
    rows.push(`<div style="margin:24px 0">${button(`${APP_URL}/billing`, 'View billing')}</div>`)
  }
  return {
    subject: `Payment received — ${amount}`,
    html: layout('Payment confirmed', rows.join('')),
  }
}

// ─── Payment failed ───────────────────────────────────────────────────────────

export function paymentFailedEmail(params: { amount?: number; currency?: string }): EmailContent {
  const amount =
    params.amount != null && params.currency
      ? ` of ${params.amount.toFixed(2)} ${params.currency.toUpperCase()}`
      : ''
  return {
    subject: 'Action needed: your payment failed',
    html: layout('We couldn’t process your payment', [
      p(`Your most recent payment${amount} didn’t go through. This usually happens when a card expires or has insufficient funds.`),
      p('Please update your payment method to keep your agent active.'),
      `<div style="margin:24px 0">${button(`${APP_URL}/billing`, 'Update payment method')}</div>`,
    ].join('')),
  }
}

// ─── Usage alert ──────────────────────────────────────────────────────────────

export function usageAlertEmail(params: {
  minutesUsed: number
  minutesLimit: number
  planName?: string
}): EmailContent {
  const pct = Math.min(100, Math.round((params.minutesUsed / params.minutesLimit) * 100))
  return {
    subject: `You’ve used ${pct}% of your monthly minutes`,
    html: layout('Usage approaching your limit', [
      p(`You’ve used <strong>${params.minutesUsed} of ${params.minutesLimit}</strong> minutes (${pct}%)${params.planName ? ` on the <strong>${esc(params.planName)}</strong> plan` : ''} this month.`),
      p('When you run out, calls beyond your plan are billed at your overage rate. Upgrade any time for more included minutes.'),
      `<div style="margin:24px 0">${button(`${APP_URL}/billing`, 'Review plan')}</div>`,
    ].join('')),
  }
}
