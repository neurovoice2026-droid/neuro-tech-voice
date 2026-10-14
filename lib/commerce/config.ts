import 'server-only'
// Platform configuration of the commerce vertical (names only; values stay
// in the environment). Everything here is read on use so a redeploy with
// new values needs no code change.

import { publicBaseUrl } from '@/lib/voice-providers/config'
import { commerceCryptoConfigured } from './crypto'

/** The public origin webhooks and OAuth callbacks are registered on (VOICE_PUBLIC_BASE_URL / NEXT_PUBLIC_APP_URL). */
export function commercePublicBaseUrl(): string | null {
  return publicBaseUrl()
}

export interface ShopifyAppConfig {
  clientId: string
  clientSecret: string
  /** Comma-separated scopes requested at install (least privilege). */
  scopes: string
  /** Admin API version pinned by the adapter (COMMERCE_SHOPIFY_API_VERSION). */
  apiVersion: string
}

export const SHOPIFY_DEFAULT_SCOPES = 'read_orders,read_customers,read_products,read_checkouts'

/** Shopify app credentials, or null when the app is not configured (the Shopify card then says so). */
export function shopifyAppConfig(): ShopifyAppConfig | null {
  const clientId = (process.env.SHOPIFY_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET ?? '').trim()
  if (!clientId || !clientSecret) return null
  const scopes = (process.env.SHOPIFY_SCOPES ?? '').trim() || SHOPIFY_DEFAULT_SCOPES
  const apiVersion = (process.env.COMMERCE_SHOPIFY_API_VERSION ?? '').trim() || '2026-07'
  return { clientId, clientSecret, scopes, apiVersion }
}

/** Polling cadence (minutes) for platforms without webhooks; default 15, 5–240. */
export function pollingMinutes(): number {
  const v = Number(process.env.COMMERCE_POLL_MINUTES)
  return Number.isFinite(v) && v >= 5 && v <= 240 ? Math.floor(v) : 15
}

/** Days a processed webhook payload / a called number is kept (default 7 / 90). */
export function webhookPayloadRetentionDays(): number {
  const v = Number(process.env.COMMERCE_WEBHOOK_PAYLOAD_RETENTION_DAYS)
  return Number.isFinite(v) && v >= 1 && v <= 90 ? Math.floor(v) : 7
}
export function runPhoneRetentionDays(): number {
  const v = Number(process.env.COMMERCE_RUN_PHONE_RETENTION_DAYS)
  return Number.isFinite(v) && v >= 7 && v <= 730 ? Math.floor(v) : 90
}

/** Wall-clock budget of one commerce worker run inside the maintenance cron. */
export function commerceWorkerBudgetMs(): number {
  const v = Number(process.env.COMMERCE_WORKER_BUDGET_MS)
  return Number.isFinite(v) && v >= 5_000 && v <= 120_000 ? Math.floor(v) : 45_000
}

export interface CommerceConfigSummary {
  encryption: boolean
  shopify: boolean
  publicBaseUrl: boolean
}

export function summarizeCommerceConfig(): CommerceConfigSummary {
  return { encryption: commerceCryptoConfigured(), shopify: !!shopifyAppConfig(), publicBaseUrl: !!commercePublicBaseUrl() }
}
