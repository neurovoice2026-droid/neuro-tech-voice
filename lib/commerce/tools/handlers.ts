import 'server-only'
// The store tools (get_order_status, get_order_items, get_product_availability,
// record_cod_confirmation, record_callback_request, mark_do_not_call). Every
// handler receives the verified call context: the order it may talk about is
// the campaign run's order, or, on an inbound call, an order the caller
// identified by number AND full name (or by the number they call from); both
// get_order_status and get_order_items identify it the same way. Nothing
// from the model's arguments selects an organization, a connection or a
// customer. Writes are idempotent per call (tool_invocations).

import { z } from 'zod'
import type { Logger } from '@/lib/observability/logger'
import { maskPhone } from '@/lib/phone/e164'
import type { ToolCallContext } from '@/lib/voice-tools/call-context'
import { claimInvocation, completeInvocation, IN_PROGRESS_MESSAGE, invocationKey, releaseInvocation, type ToolAnswer } from '@/lib/voice-tools/invocations'
import { blankToNull, nullableText, requiredText } from '@/lib/voice-tools/schemas'
import { cancelRunsForSuppressedContact } from '../automations/scheduler'
import { formatMoney } from '../automations/variables'
import { type OrderRow, ORDER_COLUMNS, PRODUCT_COLUMNS, type ProductRow, markDoNotCall, writeAudit } from '../store'
import { type CommerceToolContext, NO_STORE_MESSAGE, loadCommerceToolContext } from './context'

export type CommerceToolProvider = 'elevenlabs' | 'cartesia'

const GENERIC = 'This could not be done right now. Apologise briefly and tell the customer the store team will follow up.'

const boolean = z.preprocess((v) => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (['true', 'yes', 'da', '1', 'confirmed'].includes(t)) return true
    if (['false', 'no', 'nu', '0', 'not_confirmed'].includes(t)) return false
  }
  return v
}, z.boolean({ error: 'confirmed is missing (true or false)' }))

const Schemas = {
  get_order_status: z.object({ order_number: nullableText(40), customer_name: nullableText(120) }),
  get_order_items: z.object({ order_number: nullableText(40), customer_name: nullableText(120) }),
  get_product_availability: z.object({ query: requiredText(80, 'query') }),
  record_cod_confirmation: z.object({ confirmed: boolean, note: nullableText(200) }),
  record_callback_request: z.object({ reason: requiredText(300, 'reason'), preferred_time: nullableText(80) }),
  mark_do_not_call: z.object({ reason: nullableText(120) }),
}
export type CommerceToolName = keyof typeof Schemas

function parse<N extends CommerceToolName>(name: N, args: unknown): { ok: true; data: z.infer<(typeof Schemas)[N]> } | { ok: false; message: string } {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  const res = Schemas[name].safeParse(input)
  if (res.success) return { ok: true, data: res.data as z.infer<(typeof Schemas)[N]> }
  const problems = [...new Set(res.error.issues.map((i) => i.message))].slice(0, 3).join('; ')
  return { ok: false, message: `The ${name} call is missing information (${problems}). Ask the customer for what is missing, then call ${name} again.` }
}

// ─── Romanian wording of statuses for the agent to read out ──────────────────

const ORDER_STATUS_RO: Record<OrderRow['status'], string> = {
  pending: 'în așteptare',
  processing: 'în procesare',
  on_hold: 'în așteptare (verificare)',
  completed: 'finalizată',
  cancelled: 'anulată',
  refunded: 'rambursată',
  failed: 'eșuată',
  draft: 'ciornă',
  unknown: 'necunoscut',
}
const FINANCIAL_RO: Record<OrderRow['financial_status'], string> = {
  pending: 'neplătită încă',
  authorized: 'plată autorizată',
  paid: 'plătită',
  partially_paid: 'plătită parțial',
  partially_refunded: 'rambursată parțial',
  refunded: 'rambursată',
  voided: 'plată anulată',
  unknown: 'stare de plată necunoscută',
}
const FULFILLMENT_RO: Record<OrderRow['fulfillment_status'], string> = {
  unfulfilled: 'neexpediată încă',
  partial: 'expediată parțial',
  fulfilled: 'expediată',
  cancelled: 'expediere anulată',
  unknown: 'stare de livrare necunoscută',
}

function dateRo(iso: string | null, timezone: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Intl.DateTimeFormat('ro-RO', { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t))
}

function orderView(order: OrderRow, timezone: string) {
  return {
    order_number: order.order_number,
    status: ORDER_STATUS_RO[order.status] ?? order.status,
    payment: order.is_cod ? 'plata ramburs la livrare' : (FINANCIAL_RO[order.financial_status] ?? order.financial_status),
    delivery: FULFILLMENT_RO[order.fulfillment_status] ?? order.fulfillment_status,
    total: formatMoney(order.total === null ? null : Number(order.total), order.currency),
    items_count: order.items_count,
    items_summary: order.items_summary ?? '',
    placed_on: dateRo(order.provider_created_at, timezone),
    delivery_city: order.shipping_city ?? '',
  }
}

/** Name tokens for comparison: diacritics removed, lower case, letters only, at least two letters each. */
export function nameTokens(v: string | null): string[] {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 2)
}

/**
 * Loose comparison of the name as said vs the name on the order (diacritics
 * and order insensitive): two distinct tokens in common whenever the stored
 * name has two or more, so a first name alone never identifies an order
 * (order numbers are sequential; number + a common first name would disclose
 * other customers' orders). A stored name of a single token matches on it.
 */
export function namesMatch(given: string | null, stored: string | null): boolean {
  const a = nameTokens(given)
  const b = new Set(nameTokens(stored))
  if (!a.length || !b.size) return false
  const common = new Set(a.filter((t) => b.has(t))).size
  return common >= Math.min(2, b.size)
}

type Identification = 'ask_number' | 'ask_full_name' | 'not_found'

/** The answer when the order could not be identified: the same wording for both read tools, never confirming that an order exists. */
function identificationAnswer(result: Identification, tool: 'get_order_status' | 'get_order_items'): ToolAnswer {
  switch (result) {
    case 'ask_number':
      return { ok: false, message: `Ask the customer for the order number and the full name on the order, then call ${tool} again with both.` }
    case 'ask_full_name':
      return { ok: false, message: `A first name alone does not identify an order. Ask the customer for the full name on the order (first and last name), then call ${tool} again with the order number and the full name. Do not confirm or deny that the order exists.` }
    case 'not_found':
      return { ok: false, message: 'No order matches that number and name for this caller. Ask the customer to check the number and the name on the order (do not confirm or deny that the order exists); if it still does not match, offer a callback from the team.' }
  }
}

/**
 * The order the agent may talk about: the campaign run's order, or an order
 * the caller identified. The caller's own number counts as identification
 * when it is the order's contact number; otherwise the full name on the order
 * must match. A name of a single token gets 'ask_full_name' whether or not the
 * order exists, so the answer never discloses that an order exists for a
 * mismatched caller.
 */
async function resolveOrder(c: CommerceToolContext, args: { order_number: string | null; customer_name: string | null }): Promise<OrderRow | Identification> {
  if (c.order) return c.order
  const number = (args.order_number ?? '').replace(/^#/, '').trim()
  if (!number) return 'ask_number'
  const { data, error } = await c.call.db
    .from('commerce_orders')
    .select(ORDER_COLUMNS)
    .eq('connection_id', c.connection.id)
    .eq('org_id', c.call.org.id)
    .or(`order_number.eq.${number.replace(/[,.()]/g, '')},external_id.eq.${number.replace(/[,.()]/g, '')}`)
    .limit(2)
  if (error) throw new Error(`commerce_orders read failed: ${error.message}`)
  const rows = (data ?? []) as OrderRow[]
  const order = rows.length === 1 ? rows[0] : null
  const callerMatches = !!order && !!c.call.callerPhone && order.contact_phone_e164 === c.call.callerPhone
  if (order && (callerMatches || namesMatch(args.customer_name, order.contact_name))) return order
  if (nameTokens(args.customer_name).length < 2) return 'ask_full_name'
  return 'not_found'
}

export async function getOrderStatusTool(ctx: ToolCallContext, args: unknown, log: Logger): Promise<ToolAnswer> {
  const parsed = parse('get_order_status', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const c = await loadCommerceToolContext(ctx, log)
  if (typeof c === 'string') return { ok: false, message: c === 'no_store' ? NO_STORE_MESSAGE : GENERIC }
  const order = await resolveOrder(c, parsed.data)
  if (typeof order === 'string') return identificationAnswer(order, 'get_order_status')
  return { ok: true, message: 'Order found. Read only what the customer asks about.', order: orderView(order, ctx.org.timezone) }
}

/** Identifies the order exactly like get_order_status (the run's order, or number + full name / caller number on an inbound call): nothing is kept between tool calls. */
export async function getOrderItemsTool(ctx: ToolCallContext, args: unknown, log: Logger): Promise<ToolAnswer> {
  const parsed = parse('get_order_items', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const c = await loadCommerceToolContext(ctx, log)
  if (typeof c === 'string') return { ok: false, message: c === 'no_store' ? NO_STORE_MESSAGE : GENERIC }
  const order = await resolveOrder(c, parsed.data)
  if (typeof order === 'string') return identificationAnswer(order, 'get_order_items')
  const { data, error } = await ctx.db.from('commerce_order_items').select('name, sku, quantity, unit_price, total').eq('order_id', order.id).eq('org_id', ctx.org.id).order('created_at', { ascending: true }).limit(50)
  if (error) {
    log.error('commerce.tools.items_failed', error)
    return { ok: false, message: GENERIC }
  }
  const items = (data ?? []).map((i) => ({ name: String(i.name), quantity: Number(i.quantity ?? 1), unit_price: formatMoney(i.unit_price === null ? null : Number(i.unit_price), order.currency) }))
  return { ok: true, message: items.length ? 'Items listed.' : 'The order has no items listed.', items }
}

const STOCK_RO: Record<ProductRow['stock_status'], string> = { in_stock: 'în stoc', out_of_stock: 'fără stoc', on_backorder: 'pe comandă (precomandă)', unknown: 'stoc necunoscut' }

export async function getProductAvailabilityTool(ctx: ToolCallContext, args: unknown, log: Logger): Promise<ToolAnswer> {
  const parsed = parse('get_product_availability', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const c = await loadCommerceToolContext(ctx, log)
  if (typeof c === 'string') return { ok: false, message: c === 'no_store' ? NO_STORE_MESSAGE : GENERIC }
  const q = parsed.data.query.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!q) return { ok: false, message: 'Ask the customer which product they mean, then call get_product_availability again.' }
  const { data, error } = await ctx.db
    .from('commerce_products')
    .select(PRODUCT_COLUMNS)
    .eq('connection_id', c.connection.id)
    .eq('org_id', ctx.org.id)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(3)
  if (error) {
    log.error('commerce.tools.products_failed', error)
    return { ok: false, message: GENERIC }
  }
  const products = ((data ?? []) as ProductRow[]).map((p) => ({
    name: p.name,
    availability: STOCK_RO[p.stock_status] ?? p.stock_status,
    quantity: p.stock_quantity,
    price: formatMoney(p.price === null ? null : Number(p.price), p.currency),
  }))
  return products.length
    ? { ok: true, message: 'Products found, as last synchronized from the store.', products }
    : { ok: false, message: 'No product matches those words. Ask the customer for another name or the product code; do not guess availability.' }
}

/** Shared write wrapper: idempotent per call and arguments, audited. */
async function recordOutcome(ctx: ToolCallContext, tool: string, key: unknown, log: Logger, work: (c: CommerceToolContext) => Promise<ToolAnswer>): Promise<ToolAnswer> {
  const c = await loadCommerceToolContext(ctx, log)
  if (typeof c === 'string') return { ok: false, message: c === 'no_store' ? NO_STORE_MESSAGE : GENERIC }
  const claim = await claimInvocation(ctx.db, { orgId: ctx.org.id, callId: ctx.call.id, tool, key: invocationKey(key) }, log, ctx.now.getTime())
  if (claim.kind === 'replay') return claim.answer
  if (claim.kind === 'in_progress') return { ok: false, message: IN_PROGRESS_MESSAGE }
  try {
    const answer = await work(c)
    if (answer.ok) await completeInvocation(ctx.db, claim, answer, log)
    else await releaseInvocation(ctx.db, claim, log)
    return answer
  } catch (err) {
    log.error(`commerce.tools.${tool}_failed`, err)
    await releaseInvocation(ctx.db, claim, log)
    return { ok: false, message: GENERIC }
  }
}

export async function recordCodConfirmationTool(ctx: ToolCallContext, args: unknown, log: Logger): Promise<ToolAnswer> {
  const parsed = parse('record_cod_confirmation', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  return recordOutcome(ctx, 'record_cod_confirmation', { confirmed: parsed.data.confirmed, note: parsed.data.note }, log, async (c) => {
    if (!c.run || c.run.automation_type !== 'cod_confirmation' || !c.order) {
      return { ok: false, message: 'This call is not a cash-on-delivery confirmation call placed by the store: do not record a confirmation. If the customer wants to change an order, use record_callback_request.' }
    }
    const outcome = parsed.data.confirmed ? 'confirmed' : 'not_confirmed'
    const { error } = await ctx.db.from('commerce_automation_runs').update({ outcome, outcome_detail: parsed.data.note }).eq('id', c.run.id).eq('org_id', ctx.org.id)
    if (error) throw new Error(`commerce_automation_runs update failed: ${error.message}`)
    await writeAudit(ctx.db, { orgId: ctx.org.id, actor: 'system', action: 'cod.recorded', connectionId: c.connection.id, automationId: c.run.automation_id, runId: c.run.id, callId: ctx.call.id, metadata: { outcome, order: c.order.order_number } }, log)
    return {
      ok: true,
      message: parsed.data.confirmed
        ? `Confirmation recorded for order ${c.order.order_number}. Thank the customer and tell them the order will be shipped as agreed.`
        : `Recorded that order ${c.order.order_number} was not confirmed. Tell the customer the store team will handle it and will not ship until then.`,
    }
  })
}

export async function recordCallbackRequestTool(ctx: ToolCallContext, args: unknown, log: Logger): Promise<ToolAnswer> {
  const parsed = parse('record_callback_request', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  return recordOutcome(ctx, 'record_callback_request', { reason: parsed.data.reason, preferred_time: parsed.data.preferred_time }, log, async (c) => {
    const detail = [parsed.data.reason, parsed.data.preferred_time ? `Preferă: ${parsed.data.preferred_time}` : null].filter(Boolean).join(' · ').slice(0, 400)
    if (c.run) {
      const { error } = await ctx.db.from('commerce_automation_runs').update({ outcome: 'callback_requested', outcome_detail: detail }).eq('id', c.run.id).eq('org_id', ctx.org.id)
      if (error) throw new Error(`commerce_automation_runs update failed: ${error.message}`)
    }
    await writeAudit(
      ctx.db,
      {
        orgId: ctx.org.id,
        actor: 'system',
        action: 'callback.requested',
        connectionId: c.connection.id,
        automationId: c.run?.automation_id ?? null,
        runId: c.run?.id ?? null,
        callId: ctx.call.id,
        metadata: { detail, order: c.order?.order_number ?? null, phone: ctx.callerPhone ? maskPhone(ctx.callerPhone) : null },
      },
      log,
    )
    return { ok: true, message: 'Callback request noted for the store team. Tell the customer a person will call them back; do not promise a time.' }
  })
}

export async function markDoNotCallTool(ctx: ToolCallContext, args: unknown, log: Logger): Promise<ToolAnswer> {
  const parsed = parse('mark_do_not_call', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  return recordOutcome(ctx, 'mark_do_not_call', { dnc: true }, log, async (c) => {
    const phone = c.run?.to_phone_e164 ?? ctx.callerPhone ?? c.order?.contact_phone_e164 ?? null
    const customerId = c.customer?.id ?? c.order?.customer_id ?? null
    if (!phone && !customerId) return { ok: false, message: 'The customer could not be identified on this call. Apologise and tell them the team will remove them from the calling list.' }
    const row = await markDoNotCall(ctx.db, { orgId: ctx.org.id, connectionId: c.connection.id, customerId, phoneE164: phone, reason: parsed.data.reason ?? 'Cerere în apel', source: 'customer_opt_out' })
    if (c.run) {
      const { error } = await ctx.db.from('commerce_automation_runs').update({ outcome: 'opted_out', outcome_detail: parsed.data.reason }).eq('id', c.run.id).eq('org_id', ctx.org.id)
      if (error) throw new Error(`commerce_automation_runs update failed: ${error.message}`)
    }
    const cancelled = await cancelRunsForSuppressedContact({ db: ctx.db, orgId: ctx.org.id, connectionId: c.connection.id, timezone: ctx.org.timezone, log }, { customerId: row?.id ?? customerId, phone })
    await writeAudit(ctx.db, { orgId: ctx.org.id, actor: 'system', action: 'suppression.added', connectionId: c.connection.id, runId: c.run?.id ?? null, callId: ctx.call.id, metadata: { source: 'customer_opt_out', phone: phone ? maskPhone(phone) : null, cancelled_runs: cancelled } }, log)
    return { ok: true, message: 'Done: the customer will not be called again by the store. Confirm it to them in one sentence and end the call politely.' }
  })
}

export const COMMERCE_TOOL_HANDLERS: Record<CommerceToolName, (ctx: ToolCallContext, args: unknown, log: Logger) => Promise<ToolAnswer>> = {
  get_order_status: getOrderStatusTool,
  get_order_items: getOrderItemsTool,
  get_product_availability: getProductAvailabilityTool,
  record_cod_confirmation: recordCodConfirmationTool,
  record_callback_request: recordCallbackRequestTool,
  mark_do_not_call: markDoNotCallTool,
}

export function isCommerceToolName(v: unknown): v is CommerceToolName {
  return typeof v === 'string' && Object.hasOwn(Schemas, v) && blankToNull(v) !== null
}
