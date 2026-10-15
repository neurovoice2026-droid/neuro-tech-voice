// ─── Transactional email templates ───────────────────────────────────────────
// Each builder returns { subject, html }. Inline styles only (email clients
// don't support <style>/external CSS reliably).

import { extraMinuteRate } from '@/lib/billing/minute-packs'
import { CONTACT_SALES_PHONE, outOfMinutesChoice } from '@/lib/billing/upgrade'
import { PLANS, isPlan, type BusinessType } from '@/types'

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

/** The second choice next to a filled button: same size, brand outline. */
function outlineButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#ffffff;color:${BRAND};text-decoration:none;padding:10px 20px;border:2px solid ${BRAND};border-radius:10px;font-weight:600;font-size:14px">${esc(label)}</a>`
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
  /** What a one-time payment bought (e.g. "500 extra minutes"); shown instead of the plan. */
  itemDescription?: string
  invoiceNumber?: string | null
  invoiceUrl?: string | null
}): EmailContent {
  const amount = `${params.amount.toFixed(2)} ${params.currency.toUpperCase()}`
  const forWhat = params.itemDescription
    ? ` for <strong>${esc(params.itemDescription)}</strong>`
    : params.planName
      ? ` for the <strong>${esc(params.planName)}</strong> plan`
      : ''
  const rows = [p(`We’ve received your payment of <strong>${amount}</strong>${forWhat}. Thank you!`)]
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

// ─── Minutes ──────────────────────────────────────────────────────────────────
// Every plan has a hard cap: when the included minutes and the prepaid extra
// minutes are used up, the agent stops taking new calls until minutes are
// added (a minute pack, auto top-up, or the next billing period).

const BUY_MINUTES_URL = `${APP_URL}/billing#minutes`

function minutesButton(canBuy: boolean): string {
  return `<div style="margin:24px 0">${canBuy ? button(BUY_MINUTES_URL, 'Buy minutes') : button(`${APP_URL}/billing`, 'Choose a plan')}</div>`
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`
}

/** Sent once per billing period, on the call that first uses 80% of the plan's included minutes. */
export function usageAlertEmail(params: {
  minutesUsed: number
  minutesLimit: number
  planName?: string
  /** Prepaid extra minutes still available (used after the included minutes). */
  extraBalance?: number
  /** False on the trial: extra minutes are sold on paid plans only. */
  canBuy?: boolean
  autoTopUpEnabled?: boolean
}): EmailContent {
  const pct = Math.min(100, Math.round((params.minutesUsed / params.minutesLimit) * 100))
  const canBuy = params.canBuy !== false
  const extra = Math.max(0, Math.floor(params.extraBalance ?? 0))
  const rows = [
    p(`You’ve used <strong>${params.minutesUsed.toLocaleString('en-US')} of ${params.minutesLimit.toLocaleString('en-US')}</strong> included minutes (${pct}%)${params.planName ? ` on the <strong>${esc(params.planName)}</strong> plan` : ''} this billing period.`),
  ]
  if (extra > 0) rows.push(p(`You also have <strong>${plural(extra, 'extra minute')}</strong>, which are used after your included minutes.`))
  rows.push(
    p(
      canBuy
        ? 'When all your minutes are used up, your agent pauses: it stops taking new calls until you add minutes or your included minutes reset next month.'
        : 'When all your minutes are used up, your agent pauses: it stops taking new calls until you choose a paid plan.',
    ),
  )
  if (!canBuy) {
    rows.push(p('Choose a paid plan to keep your agent answering calls.'))
  } else if (params.autoTopUpEnabled) {
    rows.push(p('Auto top-up is on, so we’ll buy a pack automatically when your minutes run low, as long as the charge to your card goes through.'))
  } else {
    rows.push(p('To keep calls going, buy extra minutes or turn on auto top-up from the billing page. Extra minutes never expire.'))
  }
  rows.push(minutesButton(canBuy))
  return {
    subject: `You’ve used ${pct}% of your included minutes`,
    html: layout('Your minutes are running low', rows.join('')),
  }
}

/** Sent once per billing period, when the included and extra minutes are all used up. */
export function minutesExhaustedEmail(params: {
  /** organizations.plan: names the plan and prices the choice (lib/billing/upgrade.ts). */
  plan: string | null | undefined
  /** organizations.business_type: the family a trial upgrades within. */
  businessType?: BusinessType | null
}): EmailContent {
  const planName = isPlan(params.plan) ? PLANS[params.plan].name : undefined
  const canBuy = extraMinuteRate(params.plan) !== null
  const { upgrade, buy } = outOfMinutesChoice(params.plan, params.businessType)
  // Only a store has scheduled calls: lib/commerce/automations/dispatch.ts holds
  // a run for MINUTES_WAIT_HOURS (24) waiting for minutes, then skips it.
  const storeCalls = params.businessType === 'ecommerce' ? ' Scheduled store calls wait up to 24 hours for minutes, then are skipped.' : ''
  const rows = [
    p(`Your agent has used all the minutes available${planName ? ` on the <strong>${esc(planName)}</strong> plan` : ''}, so calls are paused: it isn’t taking new calls right now.${storeCalls}`),
  ]
  if (upgrade || buy) {
    rows.push(p(upgrade && buy ? 'Choose how to resume calls:' : 'To resume calls:'))
    const buttons: string[] = []
    if (upgrade) {
      // The plan picker of the billing page, or the sales line for a sales-led rung.
      const href = upgrade.kind === 'upgrade' ? `${APP_URL}${upgrade.href}` : upgrade.href
      buttons.push(button(esc(href), upgrade.label))
    }
    if (buy) buttons.push(outlineButton(esc(`${APP_URL}${buy.href}`), buy.label))
    rows.push(`<div style="margin:24px 0">${buttons.join('<span style="display:inline-block;width:10px;height:10px"></span>')}</div>`)
    if (upgrade?.kind === 'upgrade') {
      const next = PLANS[upgrade.plan]
      rows.push(p(`Upgrading to <strong>${esc(next.name)}</strong> resumes calls as soon as the new plan is active and gives you ${plural(next.minutes_limit, 'included minute')} every month.`))
    } else if (upgrade?.kind === 'contact') {
      // A tel: button does nothing in most e-mail clients on a desktop: the number is in the text too.
      rows.push(p(`Talk to us about a plan with a larger allowance: call <strong>${esc(CONTACT_SALES_PHONE)}</strong>.`))
    }
  }
  if (canBuy) {
    rows.push(p('Extra minutes never expire and are used only after your plan’s included minutes, which reset every month (on annual billing too).'))
    rows.push(p('Turn on auto top-up on the billing page to add minutes automatically next time.'))
  } else if (!upgrade) {
    rows.push(p('Choose a paid plan to keep your agent answering calls.'))
  }
  // A value that names no plan (never capped in practice): the generic button.
  if (!upgrade && !buy) rows.push(minutesButton(canBuy))
  return {
    subject: 'You’re out of minutes: calls are paused',
    html: layout('Your minutes are used up', rows.join('')),
  }
}

/** Sent when an auto top-up charge fails; auto top-up is then turned off (never retried automatically). */
export function autoTopUpFailedEmail(params: {
  minutes: number
  amount: number
  currency: string
  /** A short, customer-safe reason (e.g. the card decline message). */
  reason?: string | null
}): EmailContent {
  const amount = `${params.amount.toFixed(2)} ${params.currency.toUpperCase()}`
  const reason = params.reason?.trim()
  return {
    subject: 'Action needed: auto top-up failed',
    html: layout('We couldn’t add your extra minutes', [
      p(`We tried to charge <strong>${amount}</strong> for <strong>${plural(params.minutes, 'extra minute')}</strong>, but the payment didn’t go through${reason ? `: ${esc(reason)}${/[.!?]$/.test(reason) ? '' : '.'}` : '.'}`),
      p('Auto top-up is now turned off, so we won’t try this charge again. Update your payment method in the billing portal, then buy minutes or turn auto top-up back on from the billing page.'),
      p('When your minutes run out, your agent stops taking new calls until minutes are added.'),
      minutesButton(true),
    ].join('')),
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

/** `link` is the app's /reset-password/confirm URL carrying the one-time token. */
export function passwordResetEmail(params: { link: string }): EmailContent {
  return {
    subject: `Reset your ${APP_NAME} password`,
    html: layout(
      'Reset your password',
      p('We received a request to reset the password of your account. Open the link below and choose a new password.') +
        `<p style="margin:22px 0">${button(esc(params.link), 'Reset password')}</p>` +
        p('The link works once and expires after a short time. You can open it on any device.') +
        p("If you didn't ask for this, you can ignore this email: your password stays the same."),
    ),
  }
}
