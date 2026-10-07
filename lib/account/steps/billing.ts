import 'server-only'
// Billing for a closing account.
//
// cancel_subscriptions (first deletion step): open Checkout sessions of the
// organization's Stripe customer are expired (a checkout finished later
// cannot start a new subscription), then every subscription that is still
// live is cancelled at once: the plan, each phone number's own subscription
// and any other subscription of the customer (a webhook that was lost).
// Ownership: a stored subscription id is cancelled only when it belongs to
// the organization's customer (or carries its org_id metadata). The Stripe
// customer itself is kept: it holds the payment and invoice history.
//
// archive_billing_records: invoices and monthly usage totals are copied into
// the service-only archive (migration 021) before the organization cascade.

import type Stripe from 'stripe'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'
import { isGone } from './util'

const INACTIVE = new Set(['canceled', 'incomplete_expired'])
const MAX_LIST_PAGES = 10

interface BillingIds {
  customerId: string | null
  subscriptionIds: string[]
}

async function billingIds(ctx: StepContext): Promise<BillingIds> {
  const [{ data: org, error: orgErr }, { data: numbers, error: numErr }] = await Promise.all([
    ctx.db.from('organizations').select('stripe_customer_id, stripe_subscription_id').eq('id', ctx.orgId).maybeSingle(),
    ctx.db.from('phone_numbers').select('stripe_subscription_id').eq('org_id', ctx.orgId),
  ])
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
  if (numErr) throw new Error(`phone_numbers read failed: ${numErr.message}`)
  const ids = new Set<string>()
  const orgSub = (org?.stripe_subscription_id as string | null | undefined) ?? null
  if (orgSub) ids.add(orgSub)
  for (const n of numbers ?? []) if (n.stripe_subscription_id) ids.add(n.stripe_subscription_id as string)
  return { customerId: (org?.stripe_customer_id as string | null | undefined) ?? null, subscriptionIds: [...ids] }
}

function customerIdOf(sub: Stripe.Subscription): string | null {
  const c = sub.customer as string | { id?: string } | null
  return typeof c === 'string' ? c : c?.id ?? null
}

async function listCustomerSubscriptions(stripe: Stripe, customerId: string): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    // No status filter: every subscription that is not cancelled.
    const res = await stripe.subscriptions.list({ customer: customerId, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
    out.push(...res.data)
    if (!res.has_more || !res.data.length) break
    startingAfter = res.data[res.data.length - 1].id
  }
  return out
}

async function expireOpenCheckouts(stripe: Stripe, customerId: string, ctx: StepContext): Promise<number> {
  const res = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 })
  let expired = 0
  for (const session of res.data) {
    try {
      await stripe.checkout.sessions.expire(session.id)
      expired++
    } catch (err) {
      if (isGone(err)) continue
      // Completed or expired meanwhile ("only open sessions can be expired"):
      // a completed one is caught by the subscription pass below.
      if ((err as { type?: string }).type === 'StripeInvalidRequestError') {
        ctx.log.warn('account_deletion.checkout_not_expired', { code: (err as { code?: string }).code ?? null })
        continue
      }
      throw err
    }
  }
  return expired
}

/**
 * Cancels every live subscription of the organization. `recheck` (used again
 * just before the organization row is deleted) only lists the customer's
 * subscriptions and open checkouts.
 */
export async function stopBilling(ctx: StepContext, mode: 'cancel' | 'recheck'): Promise<Record<string, number>> {
  const ids = await billingIds(ctx)
  const counts = { cancelled: 0, already_inactive: 0, foreign_skipped: 0, checkouts_expired: 0, not_configured: 0 }
  const stored = mode === 'cancel' ? ids.subscriptionIds : []
  if (!ids.customerId && stored.length === 0) return counts
  if (!isStripeConfigured()) {
    counts.not_configured = Math.max(1, stored.length)
    ctx.log.error('account_deletion.stripe_not_configured', undefined, { subscriptions: stored.length })
    return counts
  }
  const stripe = getStripeClient()
  const toCancel = new Map<string, Stripe.Subscription | null>()
  for (const id of stored) toCancel.set(id, null)
  if (ids.customerId) {
    counts.checkouts_expired = await expireOpenCheckouts(stripe, ids.customerId, ctx)
    for (const sub of await listCustomerSubscriptions(stripe, ids.customerId)) {
      if (!INACTIVE.has(sub.status)) toCancel.set(sub.id, sub)
    }
  }
  for (const [id, listed] of toCancel) {
    let sub = listed
    if (!sub) {
      try {
        sub = await stripe.subscriptions.retrieve(id)
      } catch (err) {
        if (isGone(err)) {
          counts.already_inactive++
          continue
        }
        throw err
      }
    }
    if (INACTIVE.has(sub.status)) {
      counts.already_inactive++
      continue
    }
    const ownCustomer = !!ids.customerId && customerIdOf(sub) === ids.customerId
    const ownMetadata = sub.metadata?.org_id === ctx.orgId
    if (!ownCustomer && !ownMetadata) {
      // A stored id that points at someone else's subscription is never touched.
      counts.foreign_skipped++
      ctx.log.error('account_deletion.foreign_subscription_skipped', undefined)
      continue
    }
    try {
      await stripe.subscriptions.cancel(id)
      counts.cancelled++
    } catch (err) {
      if (isGone(err)) {
        counts.already_inactive++
        continue
      }
      throw err
    }
  }
  return counts
}

export async function cancelSubscriptions(ctx: StepContext): Promise<StepOutcome> {
  return { status: 'done', counts: await stopBilling(ctx, 'cancel') }
}

export async function archiveBillingRecords(ctx: StepContext): Promise<StepOutcome> {
  const { data, error } = await ctx.db.rpc('archive_org_billing_records', { p_org_id: ctx.orgId })
  if (error) throw new Error(`archive_org_billing_records failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as { invoices_total?: number; invoices_archived?: number; usage_months?: number } | null
  const total = Number(row?.invoices_total ?? 0)
  const archived = Number(row?.invoices_archived ?? 0)
  // Never delete the organization (and its invoices) before every invoice is in the archive.
  if (archived < total) throw new Error(`only ${archived} of ${total} invoices archived`)
  return { status: 'done', counts: { invoices_archived: archived, usage_months: Number(row?.usage_months ?? 0) } }
}
