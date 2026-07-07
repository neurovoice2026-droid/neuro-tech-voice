// ─── Organization ────────────────────────────────────────────────────────────

export type Plan = 'trial' | 'starter' | 'pro' | 'business' | 'custom'

export interface Organization {
  id: string
  user_id: string
  name: string | null
  industry: string | null
  website: string | null
  description: string | null
  logo_url: string | null
  onboarding_completed: boolean
  onboarding_step: number
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  minutes_used: number
  minutes_limit: number
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

export interface Agent {
  id: string
  org_id: string
  elevenlabs_agent_id: string | null
  name: string
  voice_id: string | null
  voice_name: string | null
  language: string
  system_prompt: string | null
  first_message: string | null
  is_active: boolean
  working_hours: WorkingHours
  fallback_message: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export type KnowledgeDocument = {
  id: string
  agent_id: string
  org_id: string
  elevenlabs_doc_id: string | null
  name: string
  type: 'pdf' | 'txt' | 'docx' | 'md' | 'url'
  url: string | null
  storage_path: string | null
  size_bytes: number
  character_count: number
  status: 'processing' | 'ready' | 'failed'
  error_message: string | null
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
  created_at: string
}

// ─── Call ─────────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs: number
}

export type CallDirection = 'inbound' | 'outbound'
export type CallStatus = 'completed' | 'failed' | 'busy' | 'no-answer' | 'in-progress'
export type Sentiment = 'positive' | 'neutral' | 'negative'

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
}

// ─── Integration ──────────────────────────────────────────────────────────────

export type IntegrationType =
  | 'google_sheets'
  | 'google_docs'
  | 'google_calendar'
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

// ─── ElevenLabs ───────────────────────────────────────────────────────────────

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
  success_rate: number
  minutes_used: number
  minutes_limit: number
}

// ─── Call Filters ─────────────────────────────────────────────────────────────

export type CallFilters = {
  search: string
  status: 'all' | 'completed' | 'failed' | 'busy' | 'no-answer'
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
  /** Monthly list price in USD. */
  price_monthly: number
  /** Annual list price in USD (billed yearly = 10× monthly, 2 months free). */
  price_annual: number
  minutes_limit: number
  /** Per-minute charge once the included minutes are exhausted (USD). */
  overage_per_min: number
  features: string[]
  stripe_price_id: string
  stripe_price_id_annual: string
  /** Custom tier — routes to "contact sales" instead of Stripe checkout. */
  contact_sales?: boolean
}

export type BillingInterval = 'month' | 'year'

// Phone numbers are NOT included in any plan — every number is purchased
// separately regardless of tier (see app/(dashboard)/phone). Every org gets
// exactly one AI voice agent regardless of tier too - there's no product
// mechanism to create more than one, so it was never a real differentiator.
// Pricing model: blended COGS ≈ $0.10/min (ElevenLabs voice + Twilio telephony).
// Each paid tier is sized so the gross margin stays ≥ 60% even at full usage;
// overage is billed at the marginal sell price (~$0.25/min) to protect margin.
export const PLANS: Record<Plan, PlanConfig> = {
  trial: {
    name: 'Trial',
    price_monthly: 0,
    price_annual: 0,
    minutes_limit: 5,
    overage_per_min: 0,
    features: [
      '5 minutes free',
      '14-day trial',
      'Basic analytics',
    ],
    stripe_price_id: '',
    stripe_price_id_annual: '',
  },
  starter: {
    name: 'Starter',
    price_monthly: 49,
    price_annual: 490,
    minutes_limit: 150,
    overage_per_min: 0.25,
    features: [
      '150 minutes/month',
      'Overage at $0.25/min',
      'Basic analytics',
      'Email support',
    ],
    stripe_price_id: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? '',
  },
  pro: {
    name: 'Pro',
    price_monthly: 249,
    price_annual: 2490,
    minutes_limit: 850,
    overage_per_min: 0.25,
    features: [
      '850 minutes/month',
      'Overage at $0.25/min',
      'Advanced analytics',
      'Call recordings',
      'Google integrations',
      'Priority support',
    ],
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? '',
  },
  business: {
    name: 'Business',
    price_monthly: 499,
    price_annual: 4990,
    minutes_limit: 1750,
    overage_per_min: 0.22,
    features: [
      '1,750 minutes/month',
      'Overage at $0.22/min',
      'Full analytics suite',
      'Call recordings',
      'All integrations',
      'Priority support',
    ],
    stripe_price_id: process.env.STRIPE_BUSINESS_PRICE_ID ?? '',
    stripe_price_id_annual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID ?? '',
  },
  custom: {
    name: 'Custom',
    price_monthly: 999,
    price_annual: 9990,
    minutes_limit: 3500,
    overage_per_min: 0.18,
    features: [
      'From 3,500 minutes/month',
      'Overage from $0.18/min',
      'Custom prompts & SLA',
      'Dedicated support',
    ],
    stripe_price_id: '',
    stripe_price_id_annual: '',
    contact_sales: true,
  },
}

/** Pick the Stripe price id for a plan + billing interval. */
export function stripePriceId(plan: Plan, interval: BillingInterval): string {
  const cfg = PLANS[plan]
  return interval === 'year' ? cfg.stripe_price_id_annual : cfg.stripe_price_id
}
