import 'server-only'
// Turns order and cart events into automation runs (commerce_automation_runs)
// and cancels runs the event made pointless. Idempotent: one run per
// automation and event (idempotency_key), one active run per automation
// and order/cart (partial unique index); a duplicate insert is a no-op.
// Nothing here dials: the dispatcher (./dispatch.ts) re-checks every rule
// before placing a call.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { maskPhone } from '@/lib/phone/e164'
import type { AutomationType, OrderStatus } from '../types'
import { type CartRow, type OrderRow, RUN_COLUMNS, type RunRow, isPhoneSuppressed, runIdempotencyKey, writeAudit } from '../store'
import { readAutomationConfig } from './config'
import { INELIGIBLE_LABELS, SUPPRESSION_REASONS, codRunObsolete, evaluate, type AutomationState, type IneligibleReason } from './eligibility'

export interface AutomationRow {
  id: string
  org_id: string
  connection_id: string
  agent_id: string | null
  type: AutomationType
  enabled: boolean
  enabled_at: string | null
  config: unknown
  script: unknown
  consent_confirmed_at: string | null
  consent_confirmed_by: string | null
  consent_version: string | null
  created_at: string
  updated_at: string
}

export const AUTOMATION_COLUMNS = 'id, org_id, connection_id, agent_id, type, enabled, enabled_at, config, script, consent_confirmed_at, consent_confirmed_by, consent_version, created_at, updated_at'

export async function listAutomations(db: SupabaseClient, orgId: string, connectionId?: string): Promise<AutomationRow[]> {
  let q = db.from('commerce_automations').select(AUTOMATION_COLUMNS).eq('org_id', orgId)
  if (connectionId) q = q.eq('connection_id', connectionId)
  const { data, error } = await q.order('created_at', { ascending: true })
  if (error) throw new Error(`commerce_automations read failed: ${error.message}`)
  return (data ?? []) as AutomationRow[]
}

export function automationState(row: AutomationRow): AutomationState {
  return { enabled: row.enabled, enabled_at: row.enabled_at, consent_confirmed_at: row.consent_confirmed_at, config: readAutomationConfig(row.type, row.config) }
}

const ACTIVE: readonly string[] = ['eligible', 'scheduled', 'retry_waiting']

export interface SchedulerContext {
  db: SupabaseClient
  orgId: string
  connectionId: string
  timezone: string
  log: Logger
  now?: Date
}

async function customerSuppressed(db: SupabaseClient, customerId: string | null): Promise<boolean> {
  if (!customerId) return false
  const { data, error } = await db.from('commerce_customers').select('do_not_call').eq('id', customerId).maybeSingle()
  if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
  return data?.do_not_call === true
}

async function insertRun(
  ctx: SchedulerContext,
  automation: AutomationRow,
  input: {
    eventKey: string
    externalRef: string
    orderId?: string | null
    customerId?: string | null
    cartId?: string | null
    status: 'scheduled' | 'suppressed'
    reason?: IneligibleReason
    phone?: string | null
    scheduledFor?: Date
  },
): Promise<RunRow | null> {
  const cfg = readAutomationConfig(automation.type, automation.config)
  const { data, error } = await ctx.db
    .from('commerce_automation_runs')
    .insert({
      org_id: ctx.orgId,
      automation_id: automation.id,
      connection_id: ctx.connectionId,
      automation_type: automation.type,
      order_id: input.orderId ?? null,
      customer_id: input.customerId ?? null,
      cart_id: input.cartId ?? null,
      external_ref: input.externalRef,
      event_key: input.eventKey,
      idempotency_key: runIdempotencyKey(automation.id, input.eventKey),
      status: input.status,
      eligibility_reason: input.reason ? INELIGIBLE_LABELS[input.reason] : null,
      to_phone_e164: input.phone ?? null,
      scheduled_for: input.scheduledFor ? input.scheduledFor.toISOString() : null,
      max_attempts: cfg.max_attempts,
      completed_at: input.status === 'suppressed' ? new Date().toISOString() : null,
    })
    .select(RUN_COLUMNS)
    .single()
  if (error) {
    // Already queued (same event) or another run of this order is still active.
    if (error.code === '23505') return null
    throw new Error(`commerce_automation_runs insert failed: ${error.message}`)
  }
  const run = data as RunRow
  await writeAudit(
    ctx.db,
    {
      orgId: ctx.orgId,
      actor: 'system',
      action: input.status === 'scheduled' ? 'run.scheduled' : 'run.suppressed',
      connectionId: ctx.connectionId,
      automationId: automation.id,
      runId: run.id,
      metadata: { type: automation.type, reference: input.externalRef, reason: input.reason ?? null, scheduled_for: run.scheduled_for, phone: input.phone ? maskPhone(input.phone) : null },
    },
    ctx.log,
  )
  return run
}

async function cancelActiveRuns(ctx: SchedulerContext, filter: { automationId?: string; externalRef?: string; cartId?: string; customerId?: string; phone?: string }, reason: string): Promise<number> {
  let q = ctx.db
    .from('commerce_automation_runs')
    .update({ status: 'cancelled', eligibility_reason: reason, completed_at: new Date().toISOString() })
    .eq('connection_id', ctx.connectionId)
    .in('status', ACTIVE)
  if (filter.automationId) q = q.eq('automation_id', filter.automationId)
  if (filter.externalRef) q = q.eq('external_ref', filter.externalRef)
  if (filter.cartId) q = q.eq('cart_id', filter.cartId)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)
  if (filter.phone) q = q.eq('to_phone_e164', filter.phone)
  const { data, error } = await q.select('id, automation_id')
  if (error) throw new Error(`commerce_automation_runs cancel failed: ${error.message}`)
  for (const r of data ?? []) {
    await writeAudit(ctx.db, { orgId: ctx.orgId, actor: 'system', action: 'run.cancelled', connectionId: ctx.connectionId, automationId: String(r.automation_id), runId: String(r.id), metadata: { reason } }, ctx.log)
  }
  return data?.length ?? 0
}

/**
 * An order was created or updated: queue COD confirmations and follow-ups
 * the automations ask for, cancel COD runs the update made pointless, and
 * cancel abandoned-cart runs for a customer who just ordered.
 */
export async function onOrderUpserted(ctx: SchedulerContext, order: OrderRow, detail: { created: boolean; previousStatus: OrderStatus | null }, automations: AutomationRow[]): Promise<void> {
  const now = ctx.now ?? new Date()
  const facts = {
    status: order.status,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    is_cod: order.is_cod,
    total: order.total === null ? null : Number(order.total),
    contact_phone_e164: order.contact_phone_e164,
    provider_created_at: order.provider_created_at,
  }
  const suppressed = facts.contact_phone_e164 ? (await customerSuppressed(ctx.db, order.customer_id)) || (await isPhoneSuppressed(ctx.db, ctx.connectionId, facts.contact_phone_e164)) : false

  for (const automation of automations) {
    if (automation.connection_id !== ctx.connectionId) continue
    const state = automationState(automation)
    if (automation.type === 'cod_confirmation') {
      if (codRunObsolete(facts)) {
        await cancelActiveRuns(ctx, { automationId: automation.id, externalRef: order.external_id }, INELIGIBLE_LABELS.order_not_open)
        continue
      }
      const verdict = evaluate({ type: 'cod_confirmation', automation: state, timezone: ctx.timezone, now, suppressed, order: facts })
      if (verdict.eligible) {
        await insertRun(ctx, automation, { eventKey: `order:${order.external_id}`, externalRef: order.external_id, orderId: order.id, customerId: order.customer_id, status: 'scheduled', phone: verdict.phone, scheduledFor: verdict.scheduledFor })
      } else if (SUPPRESSION_REASONS.has(verdict.reason) && facts.is_cod && state.enabled) {
        await insertRun(ctx, automation, { eventKey: `order:${order.external_id}`, externalRef: order.external_id, orderId: order.id, customerId: order.customer_id, status: 'suppressed', reason: verdict.reason })
      }
    } else if (automation.type === 'order_follow_up') {
      const verdict = evaluate({ type: 'order_follow_up', automation: state, timezone: ctx.timezone, now, suppressed, order: facts, previousStatus: detail.previousStatus })
      if (!verdict.eligible) {
        if (verdict.reason === 'order_not_open') await cancelActiveRuns(ctx, { automationId: automation.id, externalRef: order.external_id }, INELIGIBLE_LABELS.order_not_open)
        else if (SUPPRESSION_REASONS.has(verdict.reason) && state.enabled && detail.previousStatus !== order.status) {
          await insertRun(ctx, automation, { eventKey: `order:${order.external_id}:${state.config.follow_up_status}`, externalRef: order.external_id, orderId: order.id, customerId: order.customer_id, status: 'suppressed', reason: verdict.reason })
        }
        continue
      }
      await insertRun(ctx, automation, { eventKey: `order:${order.external_id}:${state.config.follow_up_status}`, externalRef: order.external_id, orderId: order.id, customerId: order.customer_id, status: 'scheduled', phone: verdict.phone, scheduledFor: verdict.scheduledFor })
    } else if (automation.type === 'abandoned_cart' && detail.created) {
      // The customer completed an order: a pending cart call would be a nuisance.
      if (order.customer_id) await cancelActiveRuns(ctx, { automationId: automation.id, customerId: order.customer_id }, INELIGIBLE_LABELS.cart_recovered)
      if (facts.contact_phone_e164) await cancelActiveRuns(ctx, { automationId: automation.id, phone: facts.contact_phone_e164 }, INELIGIBLE_LABELS.cart_recovered)
    }
  }
}

/** A cart event: queue an abandoned-cart call, or cancel it when the cart was recovered. */
export async function onCartUpserted(ctx: SchedulerContext, cart: CartRow, automations: AutomationRow[]): Promise<void> {
  const now = ctx.now ?? new Date()
  for (const automation of automations) {
    if (automation.type !== 'abandoned_cart' || automation.connection_id !== ctx.connectionId) continue
    const state = automationState(automation)
    if (cart.status === 'recovered' || cart.status === 'expired') {
      await cancelActiveRuns(ctx, { automationId: automation.id, externalRef: cart.external_id }, cart.status === 'recovered' ? INELIGIBLE_LABELS.cart_recovered : INELIGIBLE_LABELS.cart_not_abandoned)
      continue
    }
    const suppressed = cart.contact_phone_e164 ? (await customerSuppressed(ctx.db, cart.customer_id)) || (await isPhoneSuppressed(ctx.db, ctx.connectionId, cart.contact_phone_e164)) : false
    const verdict = evaluate({
      type: 'abandoned_cart',
      automation: state,
      timezone: ctx.timezone,
      now,
      suppressed,
      cart: { status: cart.status, total: cart.total === null ? null : Number(cart.total), contact_phone_e164: cart.contact_phone_e164, abandoned_at: cart.abandoned_at, provider_updated_at: cart.provider_updated_at, created_at: cart.created_at },
    })
    if (verdict.eligible) {
      await insertRun(ctx, automation, { eventKey: `cart:${cart.external_id}`, externalRef: cart.external_id, cartId: cart.id, customerId: cart.customer_id, status: 'scheduled', phone: verdict.phone, scheduledFor: verdict.scheduledFor })
    } else if (SUPPRESSION_REASONS.has(verdict.reason) && state.enabled) {
      await insertRun(ctx, automation, { eventKey: `cart:${cart.external_id}`, externalRef: cart.external_id, cartId: cart.id, customerId: cart.customer_id, status: 'suppressed', reason: verdict.reason })
    }
  }
}

/** The customer asked not to be called: every queued run for them is cancelled. */
export async function cancelRunsForSuppressedContact(ctx: SchedulerContext, who: { customerId?: string | null; phone?: string | null }): Promise<number> {
  let n = 0
  if (who.customerId) n += await cancelActiveRuns(ctx, { customerId: who.customerId }, INELIGIBLE_LABELS.do_not_call)
  if (who.phone) n += await cancelActiveRuns(ctx, { phone: who.phone }, INELIGIBLE_LABELS.do_not_call)
  return n
}
