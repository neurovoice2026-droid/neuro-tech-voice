// Platform prompt rules of the e-commerce vertical's store tools, composed
// into the platform rules by ./prompt.ts for both providers. The merchant's
// Romanian baseline (lib/commerce/prompt.ts) explains the flows; these rules
// pin how the tools must be used, whatever the merchant wrote. Pure.

import { SCRIPT_VARIABLES } from '@/lib/commerce/prompt'

export interface CommercePromptInput {
  /** The store tools are attached (ElevenLabs: six tools; Cartesia: store_assistant with an action). */
  storeTools: boolean
  callContext: 'variables' | 'tool' | 'none'
  /** Fallback agent: the tools are one webhook tool with an `action` parameter. */
  singleTool?: boolean
}

export function commerceToolRules(input: CommercePromptInput): string[] {
  if (!input.storeTools) return []
  const rules: string[] = []
  const name = (tool: string) => (input.singleTool ? `store_assistant with action ${tool}` : tool)
  if (input.callContext === 'variables') {
    rules.push(
      `Store calls: the variable {{call_reason}} says why this call exists: "cod_confirmation" (you called to confirm a cash-on-delivery order), "abandoned_cart" (you called about an unfinished cart), "order_follow_up" (you called after an order update) or "inbound" (the customer called the store). The variables ${SCRIPT_VARIABLES.filter((v) => v !== 'call_reason').map((v) => `{{${v}}}`).join(', ')} describe that order or cart; an empty value means it does not apply. Use them exactly as given and never invent order details.`,
    )
  } else if (input.callContext === 'tool') {
    rules.push(
      'Store calls: get_call_context tells you the reason of the call (call_reason: cod_confirmation, abandoned_cart, order_follow_up or inbound) and the order or cart it is about (order_number, items_summary, order_total, customer_name, delivery_city). Use them exactly as given and never invent order details.',
    )
  }
  rules.push(
    `Order information: on a call you placed for an order, ${name('get_order_status')} and ${name('get_order_items')} work without arguments. When a customer calls the store, ask for the order number AND the full name on the order (first and last name) and pass both to ${name('get_order_status')} and to ${name('get_order_items')} (a first name alone is not accepted), and never disclose anything about an order a tool did not confirm for this caller. Never reveal another customer's data, address or orders. Confirm the delivery address only by asking whether the delivery city on the order is still right; do not read a full address aloud unless the customer asks.`,
    `Products: use ${name('get_product_availability')} before saying anything about stock or prices; say that the information is as last synchronized from the store. Never invent discounts, delivery dates, stock or return conditions.`,
    `Outcomes: on a cash-on-delivery confirmation call, after the customer clearly answered, call ${name('record_cod_confirmation')} once with confirmed = true or false. When the customer wants a person to call back, a change, a return or a complaint, call ${name('record_callback_request')} once with what they want and when they prefer to be called. When the customer says they do not want to be called again, call ${name('mark_do_not_call')} immediately, confirm it, and end the call politely.`,
    'If a store tool answers ok = false, never pretend it worked: follow the message it returns.',
    'Never take payment card numbers, PINs or passwords. If a voicemail or answering machine answers a call you placed, do not leave order details.',
  )
  return rules
}
