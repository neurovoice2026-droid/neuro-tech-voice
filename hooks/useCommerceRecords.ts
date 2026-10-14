'use client'

import type { CustomerListDto, OrderListDto, ProductListDto, RunDto } from '@/lib/commerce/types'
import { commerceRequest, useCommercePaged, useCommerceQuery } from './useCommerceApi'

// Read-only mirrors of the store (orders, customers, products) and the
// do-not-call list. Lists are cursor-paged; filters live in the caller's
// state and arrive here as query params.

export type OrdersParams = {
  connection_id?: string
  q?: string
  status?: string
  /** "1" = cash-on-delivery orders only. */
  cod?: string
}

export function useCommerceOrders(params: OrdersParams, enabled = true) {
  return useCommercePaged<OrderListDto>(enabled ? '/api/commerce/orders' : null, params, { fallback: 'Orders could not be loaded.' })
}

export interface OrderDetailDto {
  order: OrderListDto & {
    items: Array<{ name: string; sku: string | null; quantity: number; unit_price: number | null; total: number | null }>
    shipping_summary: string | null
    contact_email_masked: string | null
    financial_status: OrderListDto['financial_status']
    provider_updated_at: string | null
  }
  runs: RunDto[]
}

export function useCommerceOrderDetail(orderId: string | null) {
  const path = orderId ? `/api/commerce/orders/${encodeURIComponent(orderId)}` : null
  return useCommerceQuery<OrderDetailDto>(path, { fallback: 'The order could not be loaded.' })
}

export type CustomersParams = {
  connection_id?: string
  q?: string
  /** "1" = do-not-call customers only. */
  dnc?: string
}

export function useCommerceCustomers(params: CustomersParams, enabled = true) {
  return useCommercePaged<CustomerListDto>(enabled ? '/api/commerce/customers' : null, params, { fallback: 'Customers could not be loaded.' })
}

export type ProductsParams = {
  connection_id?: string
  q?: string
  stock?: string
}

export function useCommerceProducts(params: ProductsParams, enabled = true) {
  return useCommercePaged<ProductListDto>(enabled ? '/api/commerce/products' : null, params, { fallback: 'Products could not be loaded.' })
}

export function useCommerceSuppressions(params: { connection_id?: string }, enabled = true) {
  return useCommercePaged<CustomerListDto>(enabled ? '/api/commerce/suppressions' : null, params, {
    fallback: 'The do-not-call list could not be loaded.',
  })
}

/** POST /api/commerce/suppressions: the customer is not called again by any automation. */
export async function suppressCustomer(customerId: string, reason?: string): Promise<CustomerListDto> {
  const res = await commerceRequest<{ customer: CustomerListDto }>('/api/commerce/suppressions', {
    method: 'POST',
    json: reason ? { customer_id: customerId, reason } : { customer_id: customerId },
    fallback: 'The customer could not be added to the do-not-call list.',
  })
  return res.customer
}

/** DELETE /api/commerce/suppressions/[customerId]: an audited operator action with a written reason. */
export async function unsuppressCustomer(customerId: string, reason: string): Promise<CustomerListDto> {
  const res = await commerceRequest<{ customer: CustomerListDto }>(`/api/commerce/suppressions/${encodeURIComponent(customerId)}`, {
    method: 'DELETE',
    json: { confirm: true, reason },
    fallback: 'The customer could not be removed from the do-not-call list.',
  })
  return res.customer
}
