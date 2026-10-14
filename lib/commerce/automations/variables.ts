import 'server-only'
// The typed script variables of one run, resolved on the server from the
// mirrors (never from the model or the provider), formatted for speech.

import type { SupabaseClient } from '@supabase/supabase-js'
import { stripPlatformVariables } from '@/lib/voice-providers/template-variables'
import type { ScriptValues } from '../prompt'
import { type CartRow, type OrderRow, CART_COLUMNS, ORDER_COLUMNS, type RunRow } from '../store'
import type { AutomationType } from '../types'

/** Variables of a call without a campaign (inbound): the agent only knows the store. */
export function inboundScriptValues(storeName: string, agentName: string): ScriptValues {
  return { store_name: clean(storeName), order_number: '', items_summary: '', order_total: '', customer_name: '', delivery_city: '', agent_name: clean(agentName), call_reason: 'inbound' }
}

function clean(v: string | null | undefined, max = 200): string {
  return stripPlatformVariables(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** "189,90 lei" / "45 EUR": a total the voice engine reads naturally. */
export function formatMoney(total: number | null, currency: string | null): string {
  if (total === null || !Number.isFinite(total)) return ''
  const n = Math.round(total * 100) / 100
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')
  const cur = (currency ?? '').toUpperCase()
  if (cur === 'RON' || cur === 'LEI') return `${text} lei`
  if (cur === 'EUR') return `${text} euro`
  return cur ? `${text} ${cur}` : text
}

export interface RunContext {
  run: RunRow
  order: OrderRow | null
  cart: CartRow | null
}

export async function loadRunContext(db: SupabaseClient, run: RunRow): Promise<RunContext> {
  const [order, cart] = await Promise.all([
    run.order_id ? db.from('commerce_orders').select(ORDER_COLUMNS).eq('id', run.order_id).eq('org_id', run.org_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    run.cart_id ? db.from('commerce_carts').select(CART_COLUMNS).eq('id', run.cart_id).eq('org_id', run.org_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (order.error) throw new Error(`commerce_orders read failed: ${order.error.message}`)
  if (cart.error) throw new Error(`commerce_carts read failed: ${cart.error.message}`)
  return { run, order: (order.data as OrderRow | null) ?? null, cart: (cart.data as CartRow | null) ?? null }
}

export function scriptValuesFor(ctx: RunContext, store: { name: string; agentName: string }): ScriptValues {
  const reason: AutomationType = ctx.run.automation_type
  const base = inboundScriptValues(store.name, store.agentName)
  base.call_reason = reason
  if (ctx.order) {
    base.order_number = clean(ctx.order.order_number, 32)
    base.items_summary = clean(ctx.order.items_summary, 400)
    base.order_total = formatMoney(ctx.order.total === null ? null : Number(ctx.order.total), ctx.order.currency)
    base.customer_name = clean(ctx.order.contact_name, 120)
    base.delivery_city = clean(ctx.order.shipping_city, 80)
  } else if (ctx.cart) {
    base.items_summary = clean(ctx.cart.items_summary, 400)
    base.order_total = formatMoney(ctx.cart.total === null ? null : Number(ctx.cart.total), ctx.cart.currency)
    base.customer_name = clean(ctx.cart.contact_name, 120)
  }
  return base
}
