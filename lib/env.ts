import 'server-only'
import { VOICE_PIPELINE_MODES, type VoicePipelineMode } from '@/lib/voice/contracts'

// Typed, lazy access to configuration. Nothing here reads process.env at
// import time and nothing throws on a missing value: every integration asks
// its is*Configured() helper first and degrades (503 not_configured, disabled
// UI) instead of crashing. The only exception is gatewayWsUrl(), whose callers
// must already have checked isGatewayConfigured().

const ENV_NAMES = [
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // App
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_NAME',
  // ElevenLabs (fallback provider)
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_WEBHOOK_SECRET',
  // Twilio
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  // Stripe
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_STARTER_ANNUAL_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_PRO_ANNUAL_PRICE_ID',
  'STRIPE_BUSINESS_PRICE_ID',
  'STRIPE_BUSINESS_ANNUAL_PRICE_ID',
  'STRIPE_OVERAGE_METER_EVENT',
  // Email
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  // Google
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  // SmartBill invoicing
  'SMARTBILL_USERNAME',
  'SMARTBILL_TOKEN',
  'SMARTBILL_COMPANY_VAT_CODE',
  'SMARTBILL_SERIES',
  'SMARTBILL_LANGUAGE',
  'SMARTBILL_TAX_NAME',
  'SMARTBILL_TAX_PERCENTAGE',
  // Cartesia
  'CARTESIA_API_KEY',
  'CARTESIA_ADMIN_API_KEY',
  'CARTESIA_TTS_MODEL',
  'CARTESIA_AGENT_MODEL',
  'CARTESIA_MONTHLY_CREDITS',
  'CARTESIA_MONTHLY_AGENT_CENTS',
  'CARTESIA_BILLING_CYCLE_ANCHOR',
  'CARTESIA_CREDIT_RESERVE',
  'CARTESIA_AGENT_CENTS_RESERVE',
  'CARTESIA_AGENT_OVERAGE',
  // OpenAI
  'OPENAI_API_KEY',
  'OPENAI_VOICE_MODEL',
  'OPENAI_ANALYSIS_MODEL',
  'OPENAI_EMBEDDING_MODEL',
  // Voice platform
  'VOICE_PIPELINE_MODE',
  /** Extra calling codes (e.g. "371,370") outbound calls, transfers and test calls may reach. */
  'CALL_DESTINATION_COUNTRY_CODES',
  'VOICE_GATEWAY_URL',
  'VOICE_GATEWAY_SECRET',
  // Infrastructure
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TOKEN_ENCRYPTION_KEY',
  'CRON_SECRET',
] as const

export type EnvName = (typeof ENV_NAMES)[number]

export const ENV_VAR_NAMES: readonly EnvName[] = ENV_NAMES

const PRODUCTION_APP_URL = 'https://neurotechvoice.com'
const DEVELOPMENT_APP_URL = 'http://localhost:3000'

/** Minimum length for VOICE_GATEWAY_SECRET; the contract asks for ≥ 32 random bytes. */
export const MIN_GATEWAY_SECRET_LENGTH = 32

// Template values copied from an example file ("your-elevenlabs-api-key",
// "<paste here>", "changeme") must not switch an integration on.
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^your[-_]/i,
  /^<.*>$/,
  /^(changeme|change[-_]me|placeholder|replace[-_]?me|todo|tbd|x{3,})$/i,
]

export function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
}

function readEnv(name: EnvName): string | undefined {
  // Dynamic lookup on purpose: this module is server-only, where every variable
  // is available at runtime, so nothing needs build-time inlining.
  const raw = process.env[name]
  if (raw === undefined) return undefined
  const value = raw.trim()
  if (!value || isPlaceholderValue(value)) return undefined
  return value
}

export const env = Object.freeze(
  Object.defineProperties(
    {},
    Object.fromEntries(
      ENV_NAMES.map((name) => [name, { enumerable: true, get: () => readEnv(name) }])
    )
  )
) as { readonly [K in EnvName]: string | undefined }

/** Value of a variable, or the fallback when it is unset or a placeholder. */
export function envString(name: EnvName, fallback: string): string {
  return readEnv(name) ?? fallback
}

/** Numeric variable; unset, placeholder or non-numeric values give the fallback. */
export function envNumber(name: EnvName, fallback: number): number {
  const value = readEnv(name)
  if (value === undefined) return fallback
  const parsed = Number(value.replace(/_/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

// ─── Integrations ────────────────────────────────────────────────────────────

export function isSupabaseAdminConfigured(): boolean {
  return !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY
}

export function isCartesiaConfigured(): boolean {
  return !!env.CARTESIA_API_KEY
}

/** Admin key for the usage API (exact credit balance). Optional. */
export function isCartesiaAdminConfigured(): boolean {
  return !!env.CARTESIA_ADMIN_API_KEY
}

export function isOpenAIConfigured(): boolean {
  return !!env.OPENAI_API_KEY
}

export function isElevenLabsConfigured(): boolean {
  return !!env.ELEVENLABS_API_KEY
}

export function isElevenLabsWebhookConfigured(): boolean {
  return !!env.ELEVENLABS_WEBHOOK_SECRET
}

export function isTwilioConfigured(): boolean {
  const sid = env.TWILIO_ACCOUNT_SID
  return !!sid && sid.startsWith('AC') && !!env.TWILIO_AUTH_TOKEN
}

/**
 * The gateway needs a reachable URL and a strong shared secret. A short secret
 * counts as not configured: signed session tokens would be guessable.
 */
export function isGatewayConfigured(): boolean {
  const secret = env.VOICE_GATEWAY_SECRET
  if (!secret || secret.length < MIN_GATEWAY_SECRET_LENGTH) return false
  return parseGatewayBase() !== null
}

export function isUpstashConfigured(): boolean {
  return !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN
}

/** OAuth client credentials. GOOGLE_REDIRECT_URI may be derived from appUrl() by the caller. */
export function isGoogleConfigured(): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET
}

/** Resend needs both the key and a verified sender address. */
export function isResendConfigured(): boolean {
  return !!env.RESEND_API_KEY && !!env.RESEND_FROM_EMAIL
}

/** Secret (sk_) or restricted (rk_) key; publishable keys can't call the API. */
export function isStripeConfigured(): boolean {
  const key = env.STRIPE_SECRET_KEY
  return !!key && (key.startsWith('sk_') || key.startsWith('rk_'))
}

export function isCronConfigured(): boolean {
  return !!env.CRON_SECRET
}

// ─── URLs and modes ──────────────────────────────────────────────────────────

/** Public base URL of the app, without a trailing slash. */
export function appUrl(): string {
  const configured = env.NEXT_PUBLIC_APP_URL
  if (!configured) return isProduction() ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL
  // Tolerate a bare host ("neurotechvoice.com"): Twilio signs the full URL, so
  // the scheme has to be right for signature checks to pass.
  const withScheme = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  return withScheme.replace(/\/+$/, '')
}

function parseGatewayBase(): URL | null {
  const raw = env.VOICE_GATEWAY_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:') url.protocol = 'wss:'
    else if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return null
    return url
  } catch {
    return null
  }
}

/**
 * WebSocket URL of a gateway endpoint. Accepts an https:// base too (Twilio
 * and browsers need ws/wss). Throws when the gateway isn't configured: callers
 * check isGatewayConfigured() first and answer 503 or pick another mode.
 */
export function gatewayWsUrl(path: '/twilio' | '/browser'): string {
  const base = isGatewayConfigured() ? parseGatewayBase() : null
  if (!base) {
    throw new Error('Voice gateway is not configured (VOICE_GATEWAY_URL / VOICE_GATEWAY_SECRET)')
  }
  const prefix = base.pathname.replace(/\/+$/, '')
  return `${base.protocol}//${base.host}${prefix}${path}`
}

let warnedInvalidMode = false

/** VOICE_PIPELINE_MODE kill switch; 'auto', unset or unknown values mean automatic selection. */
export function voicePipelineModeOverride(): VoicePipelineMode | null {
  const value = env.VOICE_PIPELINE_MODE?.toLowerCase()
  if (!value || value === 'auto') return null
  if ((VOICE_PIPELINE_MODES as readonly string[]).includes(value)) return value as VoicePipelineMode
  // A mistyped kill switch must not fail silently during an incident.
  if (!warnedInvalidMode) {
    warnedInvalidMode = true
    console.warn('[env] VOICE_PIPELINE_MODE has an unknown value; using automatic mode selection')
  }
  return null
}
