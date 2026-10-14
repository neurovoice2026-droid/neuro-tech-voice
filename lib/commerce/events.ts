import 'server-only'
// Applies normalized platform events (from webhooks or polling) to the
// mirrors and hands orders/carts to the scheduler. One place, so a webhook
// delivery and a sync page produce exactly the same side effects.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import type { CommerceEvent, NormalizedCart, NormalizedOrder } from './types'
import { type ConnectionRow, type MirrorContext, deleteMirrorRow, upsertCarts, upsertCustomers, upsertOrders, upsertProducts } from './store'
import { readCommerceProfile } from './profile'
import { DEFAULT_COD_METHODS, readAutomationConfig } from './automations/config'
import { type AutomationRow, listAutomations, onCartUpserted, onOrderUpserted, type SchedulerContext } from './automations/scheduler'

export interface ApplyContext {
  db: SupabaseClient
  connection: ConnectionRow
  log: Logger
  now?: Date
}

interface OrgFacts {
  timezone: string
  country: string | null
}

async function orgFacts(db: SupabaseClient, orgId: string): Promise<OrgFacts> {
  const { data, error } = await db.from('organizations').select('timezone, commerce_profile').eq('id', orgId).maybeSingle()
  if (error) throw new Error(`organizations read failed: ${error.message}`)
  const profile = readCommerceProfile(data?.commerce_profile)
  return { timezone: (data?.timezone as string | null) ?? profile.timezone, country: profile.country || null }
}

/** The merged COD method list of every COD automation of the connection (orders are flagged once, for all). */
function codMethodsOf(automations: AutomationRow[]): string[] {
  const set = new Set(DEFAULT_COD_METHODS)
  for (const a of automations) if (a.type === 'cod_confirmation') for (const m of readAutomationConfig(a.type, a.config).cod_payment_methods) set.add(m)
  return [...set]
}

export interface ApplyCounts {
  products: number
  customers: number
  orders: number
  carts: number
  deleted: number
  ignored: number
}

/** Writes a batch of records/events and schedules what they trigger. Bounded by the caller's page size. */
export async function applyEvents(ctx: ApplyContext, events: CommerceEvent[]): Promise<ApplyCounts> {
  const counts: ApplyCounts = { products: 0, customers: 0, orders: 0, carts: 0, deleted: 0, ignored: 0 }
  if (!events.length) return counts
  const facts = await orgFacts(ctx.db, ctx.connection.org_id)
  const mirror: MirrorContext = { orgId: ctx.connection.org_id, connectionId: ctx.connection.id, country: facts.country }
  const automations = await listAutomations(ctx.db, ctx.connection.org_id, ctx.connection.id)
  const scheduler: SchedulerContext = { db: ctx.db, orgId: ctx.connection.org_id, connectionId: ctx.connection.id, timezone: facts.timezone, log: ctx.log, now: ctx.now }

  const products = events.flatMap((e) => (e.kind === 'product.updated' ? [e.product] : []))
  const customers = events.flatMap((e) => (e.kind === 'customer.updated' ? [e.customer] : []))
  const orders: NormalizedOrder[] = events.flatMap((e) => (e.kind === 'order.created' || e.kind === 'order.updated' ? [e.order] : []))
  const carts: NormalizedCart[] = events.flatMap((e) => (e.kind === 'cart.updated' ? [e.cart] : []))

  if (products.length) counts.products = await upsertProducts(ctx.db, mirror, dedupe(products, (p) => p.externalId))
  if (customers.length) counts.customers = (await upsertCustomers(ctx.db, mirror, dedupe(customers, (c) => c.externalId))).size
  if (orders.length) {
    const writes = await upsertOrders(ctx.db, mirror, dedupe(orders, (o) => o.externalId), codMethodsOf(automations))
    counts.orders = writes.length
    for (const w of writes) {
      if (!w.created && !w.changed) continue
      await onOrderUpserted(scheduler, w.row, { created: w.created, previousStatus: w.previousStatus }, automations)
    }
  }
  if (carts.length) {
    const rows = await upsertCarts(ctx.db, mirror, dedupe(carts, (c) => c.externalId))
    counts.carts = rows.length
    for (const row of rows) await onCartUpserted(scheduler, row, automations)
  }
  for (const e of events) {
    if (e.kind === 'order.deleted') {
      await deleteMirrorRow(ctx.db, 'commerce_orders', ctx.connection.id, e.externalId)
      counts.deleted++
    } else if (e.kind === 'product.deleted') {
      await deleteMirrorRow(ctx.db, 'commerce_products', ctx.connection.id, e.externalId)
      counts.deleted++
    } else if (e.kind === 'ignored') counts.ignored++
  }
  return counts
}

/** Keeps the last occurrence of each id (a later event carries the newer state). */
function dedupe<T>(items: T[], key: (t: T) => string): T[] {
  const map = new Map<string, T>()
  for (const i of items) map.set(key(i), i)
  return [...map.values()]
}
