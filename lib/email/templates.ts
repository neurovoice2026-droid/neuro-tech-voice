import 'server-only'
import { appUrl, envString } from '@/lib/env'

// ─── Transactional email templates ───────────────────────────────────────────
// Each builder returns { subject, html }. Inline styles only (email clients
// don't support <style>/external CSS reliably). Every value that comes from a
// customer or a provider goes through esc().

const BRAND = '#7c3aed'

function appName(): string {
  return envString('NEXT_PUBLIC_APP_NAME', 'Neuro Tech Voice')
}

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
  return `<a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">${esc(label)}</a>`
}

/** Wrap body content in the branded shell. */
function layout(title: string, bodyHtml: string): string {
  const name = appName()
  const url = appUrl()
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="background:${BRAND};padding:20px 28px">
          <span style="color:#ffffff;font-size:18px;font-weight:700">${esc(name)}</span>
        </td></tr>
        <tr><td style="padding:32px 28px">
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${esc(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #eef0f3">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            ${esc(name)} · <a href="${esc(url)}" style="color:#9ca3af">${esc(url.replace(/^https?:\/\//, ''))}</a>
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

function cta(href: string, label: string): string {
  return `<div style="margin:24px 0">${button(href, label)}</div>`
}

function money(amount: number, currency = 'usd'): string {
  const code = currency.toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

/** "October 3, 2026" in the organisation's time zone (UTC if it's unknown). */
function longDate(iso: string | null | undefined, timeZone?: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timeZone || 'UTC' }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date)
  }
}

function rate(perMinute: number): string {
  return `$${perMinute.toFixed(2)}/min`
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export function welcomeEmail(params: { name?: string; agentName?: string }): EmailContent {
  const greeting = params.name ? `Hi ${esc(params.name)},` : 'Welcome!'
  const agent = params.agentName ? `<strong>${esc(params.agentName)}</strong>` : 'Your AI voice agent'
  return {
    subject: `Welcome to ${appName()} 🎉`,
    html: layout('You’re all set!', [
      p(greeting),
      p(`${agent} is configured and ready to take calls. You can manage everything from your dashboard — review calls, tweak your agent, and set up automations.`),
      cta(`${appUrl()}/dashboard`, 'Open dashboard'),
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
  const amount = money(params.amount, params.currency)
  const rows = [
    p(`We’ve received your payment of <strong>${esc(amount)}</strong>${params.planName ? ` for the <strong>${esc(params.planName)}</strong> plan` : ''}. Thank you!`),
  ]
  if (params.invoiceNumber) {
    rows.push(p(`Your fiscal invoice <strong>${esc(params.invoiceNumber)}</strong> has been issued.`))
  }
  rows.push(params.invoiceUrl ? cta(params.invoiceUrl, 'View invoice') : cta(`${appUrl()}/billing`, 'View billing'))
  return {
    subject: `Payment received — ${amount}`,
    html: layout('Payment confirmed', rows.join('')),
  }
}

// ─── Payment failed ───────────────────────────────────────────────────────────

export function paymentFailedEmail(params: { amount?: number; currency?: string }): EmailContent {
  const amount =
    params.amount != null && params.currency ? ` of ${esc(money(params.amount, params.currency))}` : ''
  return {
    subject: 'Action needed: your payment failed',
    html: layout('We couldn’t process your payment', [
      p(`Your most recent payment${amount} didn’t go through. This usually happens when a card expires or has insufficient funds.`),
      p('Your agent keeps answering while we retry the payment over the next few days. Please update your payment method so nothing gets interrupted.'),
      cta(`${appUrl()}/billing`, 'Update payment method'),
    ].join('')),
  }
}

// ─── Usage: 80% ───────────────────────────────────────────────────────────────

export function usageAlertEmail(params: {
  minutesUsed: number
  minutesLimit: number
  planName?: string
  /** Trial minutes don't renew and calls pause at the limit; paid plans bill overage instead. */
  isTrial?: boolean
  /** USD per minute past the allowance (paid plans). */
  overageRate?: number | null
  /** Extra minutes reach the invoice automatically (Stripe meter configured). */
  overageInvoiced?: boolean
  /** When the allowance renews (paid plans). */
  periodEnd?: string | null
  timeZone?: string | null
}): EmailContent {
  const limit = Math.max(1, params.minutesLimit)
  const pct = Math.min(100, Math.round((params.minutesUsed / limit) * 100))
  const renews = longDate(params.periodEnd, params.timeZone)
  const plan = params.planName ? ` on the <strong>${esc(params.planName)}</strong> plan` : ''
  const period = params.isTrial ? ' of your free trial' : renews ? ' this billing period' : ' this month'
  const price = params.overageRate ? ` at <strong>${esc(rate(params.overageRate))}</strong>` : ' at your plan’s overage rate'

  const next = params.isTrial
    ? p('When the trial minutes run out, your agent stops answering calls until you choose a plan. Upgrading takes a minute and your agent, number and settings stay exactly as they are.')
    : p(
        `Nothing stops when you reach the limit: your agent keeps answering, and extra minutes are charged${price}${params.overageInvoiced ? ' as their own line on your invoice' : ''}.${renews ? ` Your included minutes renew on <strong>${esc(renews)}</strong>.` : ''}`
      )

  return {
    subject: `You’ve used ${pct}% of your ${params.isTrial ? 'trial' : 'included'} minutes`,
    html: layout(params.isTrial ? 'Your trial minutes are almost used up' : 'You’re close to your included minutes', [
      p(`You’ve used <strong>${params.minutesUsed} of ${params.minutesLimit}</strong> minutes (${pct}%)${plan}${period}.`),
      next,
      cta(`${appUrl()}/billing`, params.isTrial ? 'Choose a plan' : 'Review plan'),
    ].join('')),
  }
}

// ─── Usage: 100% on the trial ─────────────────────────────────────────────────

export function trialMinutesUsedUpEmail(params: { minutesUsed: number; minutesLimit: number }): EmailContent {
  return {
    subject: 'Your trial minutes are used up — calls are paused',
    html: layout('Your agent has paused', [
      p(`You’ve used all <strong>${params.minutesLimit}</strong> free trial minutes, so your agent has stopped answering calls for now. Callers hear a short message asking them to call back later.`),
      p('Pick a plan to switch it back on straight away. Your agent, phone number, knowledge and settings are all kept exactly as they are.'),
      cta(`${appUrl()}/billing`, 'Choose a plan'),
      p('Not sure which plan fits? Reply to this email and we’ll help you choose.'),
    ].join('')),
  }
}

// ─── Usage: 100% on a paid plan (overage starts) ──────────────────────────────

export function overageNoticeEmail(params: {
  planName: string
  minutesLimit: number
  overageRate: number
  /** Extra minutes reach the invoice automatically (Stripe meter configured). */
  overageInvoiced?: boolean
  periodEnd?: string | null
  timeZone?: string | null
}): EmailContent {
  const renews = longDate(params.periodEnd, params.timeZone)
  return {
    subject: 'You’ve used all your included minutes — calls continue',
    html: layout('Your agent keeps answering', [
      p(`You’ve used all <strong>${params.minutesLimit}</strong> minutes included in your <strong>${esc(params.planName)}</strong> plan${renews ? ` for the period ending <strong>${esc(renews)}</strong>` : ''}.`),
      p(`Nothing stops: your agent keeps answering every call. Minutes from here on are charged at <strong>${esc(rate(params.overageRate))}</strong>${params.overageInvoiced ? ' and appear as their own line on your next invoice' : ''}.`),
      p('If this happens most months, a bigger plan is usually cheaper. The billing page shows your usage and the estimated extra cost so far.'),
      cta(`${appUrl()}/billing`, 'See usage and plans'),
    ].join('')),
  }
}

// ─── Phone number could not be set up (refunded) ──────────────────────────────

export function phoneNumberRefundEmail(params: {
  number: string
  /** Amount refunded in major units; null when nothing had been charged. */
  amount: number | null
  currency?: string | null
  /** False when the automatic refund failed and the customer is asked to reply for a manual one. */
  refunded: boolean
  /** False when cancelling the number's subscription failed (we stop it by hand). Defaults to true. */
  cancelled?: boolean
}): EmailContent {
  const number = esc(params.number)
  const cancelled = params.cancelled ?? true
  const charged = params.amount != null && params.amount > 0
  let refundText: string
  if (params.refunded && charged) {
    const amount = `<strong>${esc(money(params.amount as number, params.currency ?? 'usd'))}</strong>`
    refundText = cancelled
      ? `We’ve refunded ${amount} to your original payment method and cancelled the subscription for this number. Refunds usually appear within 5–10 business days.`
      : `We’ve refunded ${amount} to your original payment method, and we’re stopping the subscription for this number by hand so it won’t renew. Refunds usually appear within 5–10 business days.`
  } else if (params.refunded) {
    refundText = cancelled
      ? 'We’ve cancelled the subscription for this number, so you won’t be charged for it.'
      : 'Nothing was charged, and we’re stopping the subscription for this number by hand so you won’t be charged for it.'
  } else {
    refundText = cancelled
      ? 'We’ve cancelled the subscription for this number, but the automatic refund didn’t go through. Reply to this email and we’ll refund you by hand straight away.'
      : 'The automatic refund didn’t go through, so please reply to this email and we’ll refund you by hand straight away. We’re also stopping the subscription for this number so it won’t renew.'
  }
  const refundLine = p(refundText)

  return {
    subject: `We couldn’t set up ${params.number} — ${params.refunded ? 'you’ve been refunded' : 'refund on its way'}`,
    html: layout('Your new number couldn’t be activated', [
      p(`Sorry — after your payment, our phone provider wouldn’t let us activate <strong>${number}</strong>. This usually means someone else claimed the number moments earlier.`),
      refundLine,
      p('You can pick another number from your dashboard in a few seconds.'),
      cta(`${appUrl()}/phone`, 'Choose another number'),
    ].join('')),
  }
}

// ─── Account deleted ──────────────────────────────────────────────────────────

export function accountDeletedEmail(params: {
  organizationName?: string | null
  deletedAt?: string | null
  /** Phone numbers released back to the carrier as part of the deletion. */
  numbersReleased?: number
  /** True when the plan and number subscriptions were cancelled in Stripe. */
  subscriptionsCancelled?: boolean
}): EmailContent {
  const org = params.organizationName ? ` for <strong>${esc(params.organizationName)}</strong>` : ''
  const when = longDate(params.deletedAt ?? new Date().toISOString())
  const rows = [
    p(`This confirms that your account${org} was deleted${when ? ` on <strong>${esc(when)}</strong>` : ''}.`),
    p('Your AI agent, call history, recordings, knowledge documents and connected integrations have been removed from our systems.'),
  ]
  if (params.numbersReleased && params.numbersReleased > 0) {
    rows.push(p(params.numbersReleased === 1 ? 'Your phone number has been released.' : `Your ${params.numbersReleased} phone numbers have been released.`))
  }
  if (params.subscriptionsCancelled) {
    rows.push(p('Your subscriptions have been cancelled, so you won’t be charged again.'))
  }
  rows.push(p('If you didn’t ask for this, reply to this email right away.'))
  return {
    subject: `Your ${appName()} account has been deleted`,
    html: layout('Your account has been deleted', rows.join('')),
  }
}
