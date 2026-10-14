import 'server-only'
// What the store tools know about a call: the organization's store
// connection, and, on a campaign call, the run with its order/cart and
// customer, all resolved from the call row (calls.commerce_run_id) on our
// server. On an inbound call there is no run: an order is only disclosed
// after the caller identifies it (number + name, or the number they call from).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import type { ToolCallContext } from '@/lib/voice-tools/call-context'
import { type CartRow, type ConnectionRow, type CustomerRow, type OrderRow, type RunRow, CART_COLUMNS, CUSTOMER_COLUMNS, ORDER_COLUMNS, RUN_COLUMNS, primaryConnection } from '../store'

export interface CommerceToolContext {
  call: ToolCallContext
  connection: ConnectionRow
  run: RunRow | null
  order: OrderRow | null
  cart: CartRow | null
  customer: CustomerRow | null
}

export type CommerceContextFailure = 'no_store' | 'error'

export const NO_STORE_MESSAGE = 'Store tools are not available on this call. Help the caller with general information only and offer a callback from the team.'

async function one<T>(db: SupabaseClient, table: string, columns: string, id: string | null, orgId: string): Promise<T | null> {
  if (!id) return null
  const { data, error } = await db.from(table).select(columns).eq('id', id).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`${table} read failed: ${error.message}`)
  return (data as T | null) ?? null
}

export async function loadCommerceToolContext(ctx: ToolCallContext, log: Logger): Promise<CommerceToolContext | CommerceContextFailure> {
  try {
    const connection = await primaryConnection(ctx.db, ctx.org.id)
    if (!connection || connection.status === 'disconnected' || connection.status === 'draft') return 'no_store'
    const { data: callRow, error } = await ctx.db.from('calls').select('commerce_run_id').eq('id', ctx.call.id).eq('org_id', ctx.org.id).maybeSingle()
    if (error) throw new Error(`calls read failed: ${error.message}`)
    const runId = (callRow?.commerce_run_id as string | null) ?? null
    const run = await one<RunRow>(ctx.db, 'commerce_automation_runs', RUN_COLUMNS, runId, ctx.org.id)
    const order = await one<OrderRow>(ctx.db, 'commerce_orders', ORDER_COLUMNS, run?.order_id ?? null, ctx.org.id)
    const cart = await one<CartRow>(ctx.db, 'commerce_carts', CART_COLUMNS, run?.cart_id ?? null, ctx.org.id)
    const customer = await one<CustomerRow>(ctx.db, 'commerce_customers', CUSTOMER_COLUMNS, run?.customer_id ?? order?.customer_id ?? cart?.customer_id ?? null, ctx.org.id)
    return { call: ctx, connection, run, order, cart, customer }
  } catch (err) {
    log.error('commerce.tools.context_failed', err)
    return 'error'
  }
}
