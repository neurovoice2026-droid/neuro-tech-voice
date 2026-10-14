// In-call store tools of the e-commerce vertical (lib/commerce/tools). Like
// every platform tool they are authenticated by the X-NTV-Tool-Key and
// X-NTV-Call-Token headers: the org, the store connection, the campaign run
// and the caller's number are resolved on our server from the call, never
// from these parameters. Read-only except the three that record an outcome
// (confirmation, callback, do-not-call), which are idempotent.

import { READ_BEHAVIOUR, WRITE_BEHAVIOUR } from './behaviour'
import type { WebhookToolDefinition } from './types'

export const COMMERCE_TOOL_NAMES = ['get_order_status', 'get_order_items', 'get_product_availability', 'record_cod_confirmation', 'record_callback_request', 'mark_do_not_call'] as const
export type CommerceToolName = (typeof COMMERCE_TOOL_NAMES)[number]

export type CommerceToolKey = `elevenlabs.tool.commerce_${CommerceToolName}`
export const COMMERCE_TOOL_KEYS = COMMERCE_TOOL_NAMES.map((n) => `elevenlabs.tool.commerce_${n}` as CommerceToolKey)

const FOLLOW_RESULT = 'If the result has ok = false, follow its message.'

export const GET_ORDER_STATUS_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.commerce_get_order_status',
  name: 'get_order_status',
  description: `Reads the status of ONE order of the store: payment, delivery state, total and when it was placed. On a call you placed for an order, call it without arguments. When a customer calls the store, ask for the order number and the full name on the order (first and last name) first, then pass both: the tool only answers when they match the caller. Never guess an order number. ${FOLLOW_RESULT}`,
  path: '/api/telephony/tools/commerce-get-order-status',
  method: 'POST',
  behaviour: READ_BEHAVIOUR,
  body: {
    properties: {
      order_number: { type: 'string', description: 'The order number the customer gave, digits and letters exactly as said. Leave empty on a call you placed for an order.' },
      customer_name: { type: 'string', description: 'The full name on the order (first and last name) as the customer gave it. Leave empty on a call you placed for an order.' },
    },
    required: [],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message', 'order'] },
}

export const GET_ORDER_ITEMS_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.commerce_get_order_items',
  name: 'get_order_items',
  description: `Lists the products and quantities of ONE order of the store. On a call you placed for an order, call it without arguments. When a customer calls the store, pass the same order number and full name on the order you gave get_order_status (nothing is remembered between tools): it only answers when they match the caller. ${FOLLOW_RESULT}`,
  path: '/api/telephony/tools/commerce-get-order-items',
  method: 'POST',
  behaviour: READ_BEHAVIOUR,
  body: {
    properties: {
      order_number: { type: 'string', description: 'The order number the customer gave, the same as for get_order_status. Leave empty on a call you placed for an order.' },
      customer_name: { type: 'string', description: 'The full name on the order (first and last name) as the customer gave it. Leave empty on a call you placed for an order.' },
    },
    required: [],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message', 'items'] },
}

export const GET_PRODUCT_AVAILABILITY_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.commerce_get_product_availability',
  name: 'get_product_availability',
  description: `Looks up up to three products of the store by name or code and tells whether they are in stock and their price, as last synchronized. Never promise stock or prices it did not return. ${FOLLOW_RESULT}`,
  path: '/api/telephony/tools/commerce-get-product-availability',
  method: 'POST',
  behaviour: READ_BEHAVIOUR,
  body: {
    properties: { query: { type: 'string', description: 'The product name or code the customer mentioned, a few words at most.' } },
    required: ['query'],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message', 'products'] },
}

export const RECORD_COD_CONFIRMATION_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.commerce_record_cod_confirmation',
  name: 'record_cod_confirmation',
  description: `Records the customer's answer on a cash-on-delivery confirmation call you placed: confirmed = true when they clearly confirmed the order and the delivery, false when they refused, want to cancel or said they did not place it. Call it once, after the customer answered. ${FOLLOW_RESULT}`,
  path: '/api/telephony/tools/commerce-record-cod-confirmation',
  method: 'POST',
  behaviour: WRITE_BEHAVIOUR,
  body: {
    properties: {
      confirmed: { type: 'boolean', description: 'true = the customer confirmed the order; false = not confirmed, cancelled or not theirs.' },
      note: { type: 'string', description: 'Optional, one short sentence: the reason or a change the customer asked for. Never phone, card or address details.' },
    },
    required: ['confirmed'],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message'] },
}

export const RECORD_CALLBACK_REQUEST_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.commerce_record_callback_request',
  name: 'record_callback_request',
  description: `Notes for the store team that the customer wants to be called back by a person, or has a request you cannot handle (a return, a complaint, a change). Include when they prefer to be called. Call it once per call. ${FOLLOW_RESULT}`,
  path: '/api/telephony/tools/commerce-record-callback-request',
  method: 'POST',
  behaviour: WRITE_BEHAVIOUR,
  body: {
    properties: {
      reason: { type: 'string', description: 'What the customer wants, in one or two sentences.' },
      preferred_time: { type: 'string', description: 'When the customer prefers to be called, in their words (for example "mâine după ora 14"). Leave empty if they did not say.' },
    },
    required: ['reason'],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message'] },
}

export const MARK_DO_NOT_CALL_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.commerce_mark_do_not_call',
  name: 'mark_do_not_call',
  description: `The customer asked not to be called again by the store ("nu mă mai sunați", "scoateți-mă de pe listă"). Call it immediately, once; then confirm to the customer they will not be called again and end politely. ${FOLLOW_RESULT}`,
  path: '/api/telephony/tools/commerce-mark-do-not-call',
  method: 'POST',
  behaviour: WRITE_BEHAVIOUR,
  body: {
    properties: { reason: { type: 'string', description: "Optional: the customer's words in a few words." } },
    required: [],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message'] },
}

export const COMMERCE_TOOLS: Record<CommerceToolName, WebhookToolDefinition> = {
  get_order_status: GET_ORDER_STATUS_TOOL,
  get_order_items: GET_ORDER_ITEMS_TOOL,
  get_product_availability: GET_PRODUCT_AVAILABILITY_TOOL,
  record_cod_confirmation: RECORD_COD_CONFIRMATION_TOOL,
  record_callback_request: RECORD_CALLBACK_REQUEST_TOOL,
  mark_do_not_call: MARK_DO_NOT_CALL_TOOL,
}
