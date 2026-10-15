// ─── Organization ────────────────────────────────────────────────────────────

/**
 * Plan ids as stored in organizations.plan (CHECK constraint of migration 028).
 * Service plans (starter … scale, and 'custom', shown as Enterprise) are sold
 * to service organizations, store plans (store_*) to online stores; the trial
 * is shared. See PLANS.
 */
export type Plan =
  | 'trial'
  | 'starter'
  | 'growth'
  | 'pro'
  | 'business'
  | 'scale'
  | 'custom'
  | 'store_starter'
  | 'store_growth'
  | 'store_scale'
  | 'store_enterprise'

/** Which product a plan belongs to: the service product or the online-store product. */
export type PlanFamily = 'services' | 'ecommerce'

/** Which onboarding and dashboard an organization gets (migration 024). NULL = the owner has not chosen yet. */
export type BusinessType = 'services' | 'ecommerce'

export interface Organization {
  id: string
  user_id: string
  name: string | null
  /** 'services' (the original product, also the backfill of every pre-existing org) or 'ecommerce'. */
  business_type?: BusinessType | null
  /** When the owner chose the business type; null for the legacy backfill. */
  business_type_selected_at?: string | null
  /** Store profile from the store onboarding (lib/commerce/profile.ts). */
  commerce_profile?: Record<string, unknown> | null
  /** IANA zone used for working hours (default UTC). */
  timezone?: string
  /** Org-level opt-out of provider fallback (ElevenLabs → Cartesia). */
  voice_fallback_enabled?: boolean
  industry: string | null
  website: string | null
  description: string | null
  logo_url: string | null
  onboarding_completed: boolean
  onboarding_step: number
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  /** Minutes used in the current period (reset to 0 at each Stripe renewal, migration 027, and every month on an annual plan, migration 028). */
  minutes_used: number
  /** Minutes included in the plan per period. */
  minutes_limit: number
  /** Purchased extra minutes left: never expire, used after the included ones (migration 027). */
  extra_minutes_balance?: number
  /** Start of the Stripe period minutes_used counts from; null before the first renewal (and on the trial). */
  usage_period_start?: string | null
  /**
   * Billing interval of the plan subscription's price (migration 028), null
   * without one. On 'year' the included minutes still start over every month
   * (roll_annual_usage_periods, run by the maintenance cron).
   */
  billing_interval?: BillingInterval | null
  /** When the "out of minutes" e-mail was sent (once per period). */
  minutes_exhausted_notified_at?: string | null
  /** Charge the saved payment method for a pack when the minutes left fall below the threshold. */
  auto_topup_enabled?: boolean
  /** Pack bought by auto top-up (100, 500, 1000 or 2500 minutes). */
  auto_topup_pack?: number | null
  /** Minutes left (included + purchased) under which auto top-up buys a pack (10..1000). */
  auto_topup_threshold?: number | null
  auto_topup_last_attempt_at?: string | null
  /** Last failed auto top-up (auto top-up is then turned off) and its owner-facing reason. */
  auto_topup_failed_at?: string | null
  auto_topup_failure?: string | null
  created_at: string
  updated_at: string
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export interface WorkingHourSlot {
  start: string   // "09:00"
  end: string     // "18:00"
  enabled: boolean
}

export type WorkingHours = Record<string, WorkingHourSlot>

export interface BehaviorSettings {
  allow_interruptions: boolean
  auto_end_call: boolean
  auto_end_silence_seconds: number
  max_call_duration_enabled: boolean
  max_call_duration_minutes: number
  record_calls: boolean
  voicemail_detection: boolean
}

export interface OutsideHoursConfig {
  type: 'message' | 'voicemail' | 'always_answer'
  message: string
  notify_email: string
}

export interface HolidayMode {
  enabled: boolean
  from: string
  to: string
  message: string
}

/** One tone list for onboarding, the dashboard and the marketing site (lib/site.ts TONES). */
export type AgentTone = 'formal' | 'professional' | 'empathetic' | 'casual' | 'friendly' | 'energetic'

export const AGENT_TONES: readonly AgentTone[] = [
  'formal',
  'professional',
  'empathetic',
  'casual',
  'friendly',
  'energetic',
] as const


export type VoiceProviderId = 'elevenlabs' | 'cartesia'
export type ProviderResourceStatus = 'pending' | 'ready' | 'failed' | 'degraded'
export type VoiceSyncStatus = 'pending' | 'saving' | 'synced' | 'failed'

export interface Agent {
  id: string
  org_id: string
  /** Legacy mirror of the ElevenLabs external id (source of truth: agent_provider_resources). */
  elevenlabs_agent_id: string | null
  name: string
  voice_id: string | null
  voice_name: string | null
  language: string
  system_prompt: string | null
  first_message: string | null
  is_active: boolean
  working_hours: WorkingHours
  /** Conversational fallback phrase (agent doesn't understand) — NOT provider failover. */
  fallback_message: string | null
  metadata: Record<string, unknown>
  primary_provider?: VoiceProviderId
  fallback_provider?: VoiceProviderId | null
  conversation_settings?: Record<string, unknown>
  after_hours?: Record<string, unknown>
  transfer_settings?: Record<string, unknown>
  analysis_settings?: Record<string, unknown>
  privacy_settings?: Record<string, unknown>
  voice_settings?: Record<string, unknown>
  dynamic_variables?: Record<string, string>
  /** Cartesia voice used by the fallback agent (null = automatic per language). */
  fallback_voice_id?: string | null
  voice_sync_status?: VoiceSyncStatus
  voice_sync_error?: string | null
  config_revision?: number
  created_at: string
  updated_at: string
}

/** Client-safe view of one provider resource (no internal ids beyond what the owner may see). */
export interface ProviderResourceView {
  provider: VoiceProviderId
  role: 'primary' | 'fallback'
  enabled: boolean
  configured: boolean
  status: ProviderResourceStatus | 'not_configured' | 'disabled'
  last_synced_at: string | null
  last_error: string | null
}

export interface AgentStatusView {
  providers: ProviderResourceView[]
  voice: { status: VoiceSyncStatus; error: string | null }
  numbers: Array<{
    id: string
    number: string
    routing_mode: 'app_routed' | 'native_elevenlabs'
    routing_status: ProviderResourceStatus
    routing_error: string | null
  }>
  fallback_enabled: boolean
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export type KnowledgeDocument = {
  id: string
  agent_id: string
  org_id: string
  elevenlabs_doc_id: string | null
  cartesia_doc_id?: string | null
  name: string
  type: 'pdf' | 'txt' | 'docx' | 'md' | 'url' | 'text' | 'html' | 'epub'
  url: string | null
  storage_path: string | null
  size_bytes: number
  character_count: number
  status: 'processing' | 'ready' | 'failed'
  error_message: string | null
  mime_type?: string | null
  /** Set once the document is confirmed in the live agent's configuration. */
  attached_at?: string | null
  last_synced_at?: string | null
  created_at: string
}

// ─── Phone Number ─────────────────────────────────────────────────────────────

export interface PhoneNumber {
  id: string
  org_id: string
  twilio_sid: string | null
  number: string
  friendly_name: string | null
  agent_id: string | null
  country: string
  is_active: boolean
  is_verified: boolean
  monthly_cost: number
  routing_mode?: 'app_routed' | 'native_elevenlabs'
  routing_status?: ProviderResourceStatus
  routing_error?: string | null
  supports_inbound?: boolean
  supports_outbound?: boolean
  created_at: string
}

// ─── Call ─────────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs: number
}

export type CallDirection = 'inbound' | 'outbound'
export type CallStatus =
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'in-progress'
  | 'ringing'
  | 'canceled'
  | 'after-hours'
  | 'transferred'

/**
 * Why a call went where it went. Kept distinct on purpose:
 * - primary: served by the primary provider (ElevenLabs)
 * - provider_fallback: primary unavailable, Cartesia served it (see failover_reason)
 * - after_hours: closed hours handling (message/forward) before any provider
 * - transferred: handed to a human
 * - no_provider: final failure, nobody could take the call
 * - agent_inactive / number_inactive: paused by the owner
 * - quota_exhausted: the minutes are used up (included and extra; the hard cap of lib/telephony/quota.ts)
 * The conversational fallback phrase is a prompt behaviour, not a routing reason.
 */
export type RoutingReason =
  | 'primary'
  | 'provider_fallback'
  | 'after_hours'
  | 'transferred'
  | 'no_provider'
  | 'agent_inactive'
  | 'number_inactive'
  | 'quota_exhausted'
export type Sentiment = 'positive' | 'neutral' | 'negative'

/** What came of a call. Booked / Answered / Flagged are the three the site leads with. */
export type CallOutcome =
  | 'booked'
  | 'rescheduled'
  | 'cancelled'
  | 'answered'
  | 'message_taken'
  | 'transferred'
  | 'flagged'
  | 'missed'
  /** An outbound call reached voicemail (set from the provider's voicemail-detection result). */
  | 'voicemail'
  | 'spam'
  | 'other'

export const CALL_OUTCOMES: readonly CallOutcome[] = [
  'booked', 'rescheduled', 'cancelled', 'answered', 'message_taken',
  'transferred', 'flagged', 'missed', 'voicemail', 'spam', 'other',
] as const


export interface Call {
  id: string
  org_id: string
  agent_id: string | null
  agent_name?: string | null
  phone_number_id: string | null
  twilio_call_sid: string | null
  elevenlabs_conversation_id: string | null
  caller_number: string | null
  direction: CallDirection
  duration_seconds: number
  status: CallStatus
  transcript: TranscriptEntry[]
  sentiment: Sentiment | null
  summary: string | null
  recording_url: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  provider?: VoiceProviderId | null
  primary_provider?: VoiceProviderId | null
  routing_reason?: RoutingReason | null
  failover_reason?: string | null
  provider_call_id?: string | null
  from_number?: string | null
  to_number?: string | null
  outcome?: CallOutcome | null
  call_successful?: 'success' | 'failure' | 'unknown' | null
  summary_title?: string | null
  analysis?: { evaluation?: Record<string, { result: string; rationale: string | null }>; data?: Record<string, string | number | boolean | null> } | null
  termination_reason?: string | null
  has_recording?: boolean
  recording_status?: 'unknown' | 'pending' | 'available' | 'unavailable' | 'deleted'
  /** Migration 017: how the conversation started; test sessions are never billed. */
  channel?: 'phone' | 'web' | 'other'
  is_test?: boolean
  /** The owner's thumbs up/down on how the call was handled. */
  owner_feedback?: 'like' | 'dislike' | null
  /** Provider details for the call view (detail endpoint only). */
  details?: CallDetails | null
  /** The e-commerce automation run this call was placed for (migration 024). */
  commerce_run_id?: string | null
}

/** Call view extras from calls.call_metadata (lib/voice-providers/call-metadata.ts). */
export interface CallDetails {
  main_language: string | null
  queue_wait_secs: number | null
  tool_events: Array<{ tool: string; kind: string; ok: boolean; result_type: string | null; at_secs: number }>
  provider_error: { code: number; reason: string | null } | null
  warnings: string[]
  /** Content (transcript, summary, analysis) removed by the privacy retention. */
  content_purged: boolean
  /** The provider conversation can be analysed again (ElevenLabs calls). */
  can_reanalyze: boolean
}

// ─── Integration ──────────────────────────────────────────────────────────────

export type IntegrationType =
  | 'google_sheets'
  | 'google_docs'
  | 'google_calendar'
  | 'google_drive'
  | 'gmail'
  | 'webhook'

export interface Integration {
  id: string
  org_id: string
  type: IntegrationType
  config: Record<string, unknown>
  is_active: boolean
  connected_at: string
  created_at: string
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageUrgency = 'normal' | 'urgent'

// ─── Voices ───────────────────────────────────────────────────────────────────

/** A voice as the dashboard sees it (provider-neutral, from GET /api/voices). */
export interface VoiceOption {
  provider: VoiceProviderId
  voiceId: string
  name: string
  description: string | null
  language: string | null
  accent: string | null
  gender: 'female' | 'male' | 'neutral' | null
  age: string | null
  category: string | null
  source: 'premade' | 'library' | 'cloned' | 'designed' | 'provider'
  /** Public preview audio URL when the provider offers one (else use POST /api/voices/preview). */
  previewUrl: string | null
  requiresProvisioning: boolean
  libraryRef: { publicOwnerId: string; voiceId: string } | null
  /** A curated platform voice for the requested language. */
  recommended?: boolean
}

// ─── ElevenLabs (legacy shape, kept for old callers) ──────────────────────────

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  description: string | null
  preview_url: string | null
  labels: Record<string, string>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  total_calls: number
  total_duration_seconds: number
  avg_duration_seconds: number
  calls_today: number
  calls_this_week: number
  calls_this_month: number
  sentiment_breakdown: {
    positive: number
    neutral: number
    negative: number
  }
  peak_hour: number
  /** Answered rate: share of finished calls that completed (telephony). */
  success_rate: number
  minutes_used: number
  minutes_limit: number
  /** Purchased extra minutes left (organizations.extra_minutes_balance). */
  extra_balance?: number
  /** Minutes left in total: the period's included minutes left + extra_balance. */
  total_left?: number
  /** AI resolution rate: success / (success + failure) of call_successful; null without verdicts. */
  ai_success_rate?: number | null
  ai_outcome_breakdown?: { success: number; failure: number; unknown: number }
  /** Calls per outcome (booked, message_taken, transferred, …). */
  outcome_breakdown?: Record<string, number>
}

// ─── Call Filters ─────────────────────────────────────────────────────────────

export type CallFilters = {
  search: string
  status: 'all' | 'completed' | 'failed' | 'busy' | 'no-answer' | 'after-hours' | 'transferred'
  direction: 'all' | 'inbound' | 'outbound'
  sentiment: 'all' | 'positive' | 'neutral' | 'negative'
  dateFrom: string
  dateTo: string
  minDuration: number
  sortBy: 'created_at' | 'duration_seconds' | 'caller_number'
  sortOrder: 'asc' | 'desc'
}

export type CallStats = {
  total_calls: number
  calls_this_month: number
  calls_last_month: number
  month_trend: number
  avg_duration_seconds: number
  total_duration_seconds: number
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface PlanConfig {
  name: string
  /**
   * Monthly list price in USD. 0 on the trial, and on Enterprise ('custom'),
   * which publishes no price at all: it is agreed with the customer
   * (contact_sales). Never print a fee for a contact-sales plan whose price
   * is 0; Store Enterprise's is a starting point ("from $1,000").
   */
  price_monthly: number
  /** Annual list price in USD (billed yearly = 10× monthly, 2 months free). */
  price_annual: number
  /**
   * Minutes included per billing period. On Enterprise this is the allowance
   * it starts from (Scale's); the real one is agreed with the customer.
   */
  minutes_limit: number
  /**
   * Price of one extra minute (USD): prepaid packs of lib/billing/minute-packs.ts
   * are priced at this rate, less a volume discount. Nothing is billed after
   * the fact; 0 on the trial, which cannot buy minutes. The field keeps its
   * historical name.
   */
  overage_per_min: number
  features: string[]
  /**
   * Optional Stripe price pins from the env (STRIPE_<PLAN>[_ANNUAL]_PRICE_ID).
   * A pin is used only while Stripe reports it active, in USD, on this
   * interval and at exactly this plan's price, and it is tagged for the plan
   * (metadata.ntv_plan on the price, else on its product); otherwise the
   * app's own price (found or created by lookup key, lib/stripe/store-prices.ts)
   * is charged. The billing webhook still maps a pinned id back to its plan.
   */
  stripe_price_id: string
  stripe_price_id_annual: string
  /** Sales-led tier: routes to "contact sales" instead of Stripe checkout. */
  contact_sales?: boolean
  /** Who may hold the plan: a service organization, an online store, or ('any', the trial only) both. */
  family: PlanFamily | 'any'
}

export type BillingInterval = 'month' | 'year'

/** "15000" → "15,000", the same in every runtime (no locale data needed). */
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
/** The allowance bullet of a plan card: "1,000 minutes/month". */
const minutesBullet = (minutes: number) => `${groupDigits(minutes)} minutes/month`
/** The extra-minute bullet of a plan card: "Extra minutes at $0.20/min". */
const extraMinutesBullet = (rate: number) => `Extra minutes at $${rate.toFixed(2)}/min`

/** The price of one extra minute on every service plan (the owner's price list). */
const SERVICE_EXTRA_MINUTE = 0.2

// Phone numbers are NOT included in any plan — every number is purchased
// separately regardless of tier (see app/(dashboard)/phone). Every org gets
// exactly one AI voice agent regardless of tier too - there's no product
// mechanism to create more than one, so it was never a real differentiator.
//
// Service plans are the owner's price list of 23 Sep 2026, the one the
// homepage prints (lib/site.ts TIERS reads its numbers from here, so the two
// cannot drift; tests/plan-parity.test.ts holds them together): Starter $49
// for 400 minutes, Growth $99 for 1,000, Pro $249 for 3,000, Business $499
// for 5,000, Scale $990 for 15,000, extra minutes at $0.20 on every plan, and
// Enterprise priced with the customer. The feature bullets say what the
// homepage cards say.
//
// Pricing model, stated truthfully: the blended cost is about $0.10 a minute
// (ElevenLabs voice + Twilio telephony). An included minute sells for $0.1225
// on Starter, $0.099 on Growth, $0.083 on Pro, $0.0998 on Business and $0.066
// on Scale when every included minute is used, so at full use Starter keeps a
// thin margin, Growth and Business run near break-even, and Pro and Scale run
// below cost. The margin comes from allowances that are not used to the last
// minute and from extra minutes: at $0.20 they keep about half of what they
// sell for. Every plan stops at its minutes (hard cap); paid plans can buy
// prepaid extra-minute packs at overage_per_min, with volume discounts
// (lib/billing/minute-packs.ts).
//
// Store plans (family 'ecommerce') carry a larger fee per included minute,
// because their calls are short outbound confirmations (~1.5 min each: the
// card's "about 230 order calls a month" = 350 minutes): $100 for 350 minutes is $0.29 a
// minute, $250 for 950 is $0.26 and $500 for 2,000 is $0.25, well above the
// cost; their extra minutes run $0.25 down to $0.18; Store Enterprise is
// negotiated from $1,000.
// Annual = 10 × monthly on every paid plan (two months free).
export const PLANS: Record<Plan, PlanConfig> = {
  trial: {
    name: 'Trial',
    price_monthly: 0,
    price_annual: 0,
    minutes_limit: 5,
    overage_per_min: 0,
    // The trial card already prints its minutes ("5 min included") and its
    // fourteen days ("$0 for 14 days"): the bullets say what else it has.
    features: [
      'Test calls never use your minutes',
      'Basic analytics',
    ],
    stripe_price_id: '',
    stripe_price_id_annual: '',
    family: 'any',
  },
  starter: {
    name: 'Starter',
    price_monthly: 49,
    price_annual: 490,
    minutes_limit: 400,
    overage_per_min: SERVICE_EXTRA_MINUTE,
    features: [
      minutesBullet(400),
      'Answers from your own documents',
      'Transcripts of your calls, kept',
      'Confirmation texts to your callers',
      'Outbound calls you start from the dashboard',
      extraMinutesBullet(SERVICE_EXTRA_MINUTE),
    ],
    stripe_price_id: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? '',
    family: 'services',
  },
  growth: {
    name: 'Growth',
    price_monthly: 99,
    price_annual: 990,
    minutes_limit: 1000,
    overage_per_min: SERVICE_EXTRA_MINUTE,
    features: [
      minutesBullet(1000),
      'Everything in Starter',
      '2.5× Starter\'s minutes',
      'Under $0.10 a minute when all 1,000 are used',
      extraMinutesBullet(SERVICE_EXTRA_MINUTE),
    ],
    stripe_price_id: process.env.STRIPE_GROWTH_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID ?? '',
    family: 'services',
  },
  pro: {
    name: 'Pro',
    price_monthly: 249,
    price_annual: 2490,
    minutes_limit: 3000,
    overage_per_min: SERVICE_EXTRA_MINUTE,
    features: [
      minutesBullet(3000),
      'Everything in Growth',
      'Call recordings',
      'Google Workspace, in beta: Gmail, Sheets, Calendar and Docs',
      '30-day call analytics',
      'Clone your own voice',
      'Custom integrations, set up by our team',
      '24/7 priority support from a real person',
      extraMinutesBullet(SERVICE_EXTRA_MINUTE),
    ],
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? '',
    family: 'services',
  },
  business: {
    name: 'Business',
    price_monthly: 499,
    price_annual: 4990,
    minutes_limit: 5000,
    overage_per_min: SERVICE_EXTRA_MINUTE,
    features: [
      minutesBullet(5000),
      'Everything in Pro',
      '90-day call analytics',
      '3× Pro\'s voice-lab allowance',
      '30 test calls a day, up from 20',
      'A setup call with our team to get your agent live',
      'A monthly review of your calls with our team',
      extraMinutesBullet(SERVICE_EXTRA_MINUTE),
    ],
    stripe_price_id: process.env.STRIPE_BUSINESS_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID ?? '',
    family: 'services',
  },
  scale: {
    name: 'Scale',
    price_monthly: 990,
    price_annual: 9900,
    minutes_limit: 15000,
    overage_per_min: SERVICE_EXTRA_MINUTE,
    features: [
      minutesBullet(15000),
      'Everything in Business',
      '3× Business\'s minutes',
      'Under $0.07 a minute when all 15,000 are used',
      'Priority onboarding',
      extraMinutesBullet(SERVICE_EXTRA_MINUTE),
    ],
    stripe_price_id: process.env.STRIPE_SCALE_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_SCALE_ANNUAL_PRICE_ID ?? '',
    family: 'services',
  },
  // Enterprise keeps the backend id 'custom'. No fee is published (0 here,
  // "Talk to us" on every card), its minutes and rate are agreed with the
  // customer: minutes_limit is the allowance it starts from (Scale's), and
  // prepaid extra minutes cost the same $0.20 as on every service plan.
  custom: {
    name: 'Enterprise',
    price_monthly: 0,
    price_annual: 0,
    minutes_limit: 15000,
    overage_per_min: SERVICE_EXTRA_MINUTE,
    features: [
      'Everything in Scale',
      'Minutes and a rate set with you',
      'The largest voice-lab allowance',
      '50 test calls a day',
      'A written SLA',
      'A named contact',
    ],
    stripe_price_id: '',
    stripe_price_id_annual: '',
    contact_sales: true,
    family: 'services',
  },
  // Store plans: values unchanged since their launch (lib/pages/home/store-pricing.ts
  // prints them as they are here). Their price pins are optional, like every plan's.
  store_starter: {
    name: 'Store Starter',
    price_monthly: 100,
    price_annual: 1000,
    minutes_limit: 350,
    overage_per_min: 0.25,
    // A store card prints the allowance, the order calls it covers and the
    // extra-minute rate above its perks (lib/pages/home/store-pricing.ts
    // STORE_PRICING.plan), so the perks never repeat them.
    features: [
      'COD confirmation, abandoned cart & delivery follow-up calls',
      'WooCommerce, Shopify, Magento, PrestaShop or custom API',
      'Live order lookups during calls',
      'Email support',
    ],
    stripe_price_id: process.env.STRIPE_STORE_STARTER_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_STORE_STARTER_ANNUAL_PRICE_ID ?? '',
    family: 'ecommerce',
  },
  store_growth: {
    name: 'Store Growth',
    price_monthly: 250,
    price_annual: 2500,
    minutes_limit: 950,
    overage_per_min: 0.22,
    features: [
      'Everything in Store Starter',
      'Call recordings & analytics',
      'Priority support',
    ],
    stripe_price_id: process.env.STRIPE_STORE_GROWTH_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_STORE_GROWTH_ANNUAL_PRICE_ID ?? '',
    family: 'ecommerce',
  },
  store_scale: {
    name: 'Store Scale',
    price_monthly: 500,
    price_annual: 5000,
    minutes_limit: 2000,
    overage_per_min: 0.2,
    features: [
      'Everything in Store Growth',
      'All integrations',
      'Dedicated onboarding',
    ],
    stripe_price_id: process.env.STRIPE_STORE_SCALE_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_STORE_SCALE_ANNUAL_PRICE_ID ?? '',
    family: 'ecommerce',
  },
  store_enterprise: {
    name: 'Store Enterprise',
    price_monthly: 1000,
    price_annual: 10000,
    minutes_limit: 4500,
    overage_per_min: 0.18,
    // Its card's line says "4,500 minutes and up, your own scripts and an SLA, priced with you."
    features: [
      'Everything in Store Scale',
      'Custom scripts & SLA',
      'Dedicated support',
    ],
    stripe_price_id: '',
    stripe_price_id_annual: '',
    contact_sales: true,
    family: 'ecommerce',
  },
}

/** The plans a service organization may buy, cheapest first, Enterprise last (the trial is implicit). */
export const SERVICE_PLANS: readonly Plan[] = ['starter', 'growth', 'pro', 'business', 'scale', 'custom'] as const

/** The plans an online store may buy, cheapest first (the trial is implicit). */
export const STORE_PLANS: readonly Plan[] = ['store_starter', 'store_growth', 'store_scale', 'store_enterprise'] as const

/**
 * Whether a plan is bought through Stripe Checkout: a paid plan that is not
 * sales-led. Its Stripe price is resolved (and validated against PLANS) by
 * lib/stripe/store-prices.ts ensurePlanPriceId.
 */
export function isSelfServePlan(plan: Plan): boolean {
  const cfg = Object.hasOwn(PLANS, plan) ? PLANS[plan] : undefined
  return !!cfg && cfg.contact_sales !== true && cfg.price_monthly > 0
}

/** The plans bought through Stripe Checkout, both families, in catalogue order. */
export const SELF_SERVE_PLANS: readonly Plan[] = (Object.keys(PLANS) as Plan[]).filter(isSelfServePlan)

/** True for a string that names a plan (never for '__proto__' or a plan Stripe knows but we do not). */
export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && Object.hasOwn(PLANS, value)
}

/** The plan family an organization buys from: online stores get the store plans, everything else (services, legacy NULL) the service plans. */
export function planFamilyOf(businessType: BusinessType | null | undefined): PlanFamily {
  return businessType === 'ecommerce' ? 'ecommerce' : 'services'
}

/** The paid plans offered to an organization of this business type, cheapest first. */
export function plansForBusinessType(businessType: BusinessType | null | undefined): readonly Plan[] {
  return planFamilyOf(businessType) === 'ecommerce' ? STORE_PLANS : SERVICE_PLANS
}

/**
 * Whether an organization of this business type may hold the plan: the trial
 * always, otherwise only a plan of its own family. The server enforces this
 * at checkout and onboarding (409 plan_not_available); the UI only shows the
 * matching family.
 */
export function planAllowedFor(plan: Plan, businessType: BusinessType | null | undefined): boolean {
  if (plan === 'trial') return true
  return PLANS[plan]?.family === planFamilyOf(businessType)
}

/** The 409 plan_not_available message of checkout and onboarding. */
export const PLAN_NOT_AVAILABLE_MESSAGE = 'This plan is not available for your type of business.'

/**
 * The env-pinned Stripe price id of a plan and billing interval, '' when none
 * is pinned. Checkout never charges it blindly: lib/stripe/store-prices.ts
 * ensurePlanPriceId validates it against PLANS (and its ntv_plan tag) first.
 */
export function stripePriceId(plan: Plan, interval: BillingInterval): string {
  const cfg = PLANS[plan]
  return interval === 'year' ? cfg.stripe_price_id_annual : cfg.stripe_price_id
}
