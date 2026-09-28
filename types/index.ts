// ─── Organization ────────────────────────────────────────────────────────────

import type {
  CallEndReason,
  KnowledgeSourceRef,
  VoicePipelineMode,
  VoiceToolName,
} from '@/lib/voice/contracts'

export type { VoicePipelineMode, KnowledgeSourceRef, CallEndReason } from '@/lib/voice/contracts'

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
  /** IANA time zone used for bookings, working hours and analytics buckets. */
  timezone: string
  /** Trial end; calls are refused after it on the trial plan. */
  trial_ends_at: string | null
  billing_interval: BillingInterval | null
  /** Current usage period; minutes_used resets when it rolls over. */
  usage_period_start: string | null
  usage_period_end: string | null
  /** Org-wide switch for caller SMS (confirmations, reminders, send_sms tool). */
  sms_enabled: boolean
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

export type ProviderSyncStatus = 'synced' | 'pending' | 'error' | 'disabled'

export interface ProviderSyncEntry {
  status: ProviderSyncStatus
  synced_at: string | null
  /** Human-readable, never a raw upstream body. */
  error: string | null
  /** Hash of the config last pushed, to skip no-op syncs. */
  hash?: string | null
  /** Cartesia agent version id after the last PATCH. */
  version_id?: string | null
}

export interface ProviderSyncState {
  cartesia?: ProviderSyncEntry
  elevenlabs?: ProviderSyncEntry
}

/** A question the agent asks and the answer it captures (lead qualification). */
export interface LeadField {
  key: string
  label: string
  question: string
  required: boolean
}

export interface Agent {
  id: string
  org_id: string
  /** Standby ElevenLabs agent used as the fallback. */
  elevenlabs_agent_id: string | null
  /** Cartesia Managed Agent used when model credits are exhausted. */
  cartesia_agent_id: string | null
  name: string
  /** ElevenLabs voice for the fallback path. */
  voice_id: string | null
  voice_name: string | null
  /** Primary voice (Cartesia Sonic). */
  cartesia_voice_id: string | null
  cartesia_voice_name: string | null
  language: string
  system_prompt: string | null
  first_message: string | null
  is_active: boolean
  working_hours: WorkingHours
  fallback_message: string | null
  tone: AgentTone
  /** Sonic speed 0.6-1.5; null = voice default. */
  voice_speed: number | null
  voice_emotion: string | null
  /** Words the speech recogniser should expect (brand names, services). */
  keyterms: string[]
  lead_fields: LeadField[]
  /** Adds a short "this call may be recorded" line to the greeting. */
  recording_notice: boolean
  /** Forces one pipeline mode for this agent (support/debug); null = automatic. */
  pipeline_mode_override: VoicePipelineMode | null
  provider_sync: ProviderSyncState
  /** Keys: behavior_settings (BehaviorSettings), outside_hours (OutsideHoursConfig), holiday_mode (HolidayMode). */
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
  /** Cartesia knowledge-base document id (best effort; the Managed Agents KB is still rolling out). */
  cartesia_doc_id: string | null
  name: string
  type: 'pdf' | 'txt' | 'docx' | 'md' | 'url'
  url: string | null
  storage_path: string | null
  size_bytes: number
  character_count: number
  chunk_count: number
  content_sha256: string | null
  extracted_text_path: string | null
  status: 'processing' | 'ready' | 'failed'
  error_message: string | null
  provider_sync: ProviderSyncState
  created_at: string
  updated_at: string | null
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
  elevenlabs_phone_number_id: string | null
  stripe_subscription_id: string | null
  /** app_router = our /api/telephony/inbound owns the Twilio voice URL; elevenlabs_import = legacy native import. */
  routing_mode: 'app_router' | 'elevenlabs_import' | null
  sms_capable: boolean
  voice_url: string | null
  routing_synced_at: string | null
  routing_error: string | null
  created_at: string
}

// ─── Call ─────────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs: number
  interrupted?: boolean
  /** Knowledge passages the agent answered from. */
  sources?: KnowledgeSourceRef[]
  tool_calls?: { name: VoiceToolName; ok: boolean }[]
}

export type CallDirection = 'inbound' | 'outbound'
export type CallStatus = 'completed' | 'failed' | 'busy' | 'no-answer' | 'in-progress'
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
  | 'spam'
  | 'other'

export const CALL_OUTCOMES: readonly CallOutcome[] = [
  'booked', 'rescheduled', 'cancelled', 'answered', 'message_taken',
  'transferred', 'flagged', 'missed', 'spam', 'other',
] as const

/** Structured post-call analysis (OpenAI structured output), stored in calls.analysis. */
export interface CallAnalysis {
  summary: string
  sentiment: Sentiment
  sentiment_reason: string
  outcome: CallOutcome
  /** Short snake_case label, e.g. book_appointment, pricing_question. */
  intent: string
  caller_name: string | null
  follow_up_required: boolean
  follow_up_reason: string | null
  flag_reason: string | null
  keywords: string[]
  /** BCP-47 */
  language: string
  /** Lead fields captured, keyed by LeadField.key. */
  extracted: { key: string; value: string }[]
  model: string
  analyzed_at: string
}

export interface Call {
  id: string
  org_id: string
  agent_id: string | null
  agent_name?: string | null
  phone_number_id: string | null
  twilio_call_sid: string | null
  elevenlabs_conversation_id: string | null
  voice_provider: 'cartesia' | 'elevenlabs'
  pipeline_mode: VoicePipelineMode | null
  /** Cartesia agent call id (ac_...) or ElevenLabs conversation id. */
  provider_call_id: string | null
  /** For inbound calls this is the caller; kept for backwards compatibility. */
  caller_number: string | null
  from_number: string | null
  to_number: string | null
  direction: CallDirection
  is_test: boolean
  duration_seconds: number
  status: CallStatus
  end_reason: CallEndReason | string | null
  fallback_used: boolean
  fallback_reason: string | null
  transcript: TranscriptEntry[]
  sentiment: Sentiment | null
  summary: string | null
  outcome: CallOutcome | null
  intent: string | null
  tags: string[]
  extracted: Record<string, string>
  analysis: CallAnalysis | null
  knowledge_sources: KnowledgeSourceRef[]
  /** Always an app URL (/api/calls/{id}/audio) or null; never a provider URL. */
  recording_url: string | null
  recording_sid: string | null
  recording_duration_seconds: number | null
  usage_recorded_at: string | null
  stt_model: string | null
  agent_seconds: number | null
  llm_cached_input_tokens: number | null
  cartesia_credits: number | null
  billable_seconds: number | null
  billed_minutes: number | null
  tts_characters: number | null
  stt_seconds: number | null
  llm_input_tokens: number | null
  llm_output_tokens: number | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string | null
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
  /** OAuth scopes granted (Google integrations). */
  scopes: string[]
  /** Connected Google account, for display. */
  account_email: string | null
  connected_at: string
  created_at: string
}

// ─── Voice ────────────────────────────────────────────────────────────────────

/** Provider-neutral voice shown in pickers. id is the provider's voice id. */
export interface Voice {
  provider: 'cartesia' | 'elevenlabs'
  id: string
  name: string
  description: string | null
  tagline: string | null
  gender: 'masculine' | 'feminine' | 'gender_neutral' | null
  /** ISO 639-1 of the native accent. */
  language: string | null
  /** e.g. [{ accent: 'british', locale: 'en-GB', is_native: true }] */
  accents: { accent: string; locale: string; is_native: boolean }[]
  /** True when the voice belongs to this organisation (a clone). */
  is_owner: boolean
  is_pro: boolean
  /** App-relative preview URL (/api/voices/{id}/preview), never a signed provider URL. */
  preview_url: string | null
}

export interface VoiceClone {
  id: string
  org_id: string
  cartesia_voice_id: string
  elevenlabs_voice_id: string | null
  name: string
  language: string
  accent: string | null
  gender: 'masculine' | 'feminine' | 'gender_neutral' | null
  source_storage_path: string | null
  consent_attested_by: string
  consent_attested_at: string
  consent_statement: string
  status: 'ready' | 'failed' | 'deleted'
  created_at: string
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export interface ServiceOffering {
  name: string
  duration_minutes: number
}

export interface SchedulingSettings {
  org_id: string
  /** Google Calendar id, primary by default. */
  calendar_id: string
  slot_minutes: number
  buffer_minutes: number
  min_notice_minutes: number
  max_days_ahead: number
  /** Weekday (monday...sunday) to open slots; same shape as agents.working_hours. */
  business_hours: WorkingHours
  services: ServiceOffering[]
  send_sms_confirmation: boolean
  send_reminders: boolean
  reminder_hours_before: number
  updated_at: string
}

export type BookingStatus = 'booked' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show'

export interface Booking {
  id: string
  org_id: string
  agent_id: string | null
  call_id: string | null
  calendar_id: string
  google_event_id: string | null
  caller_name: string
  caller_phone: string | null
  caller_email: string | null
  service: string | null
  starts_at: string
  ends_at: string
  timezone: string
  status: BookingStatus
  notes: string | null
  confirmation_sent_at: string | null
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface WaitlistEntry {
  id: string
  org_id: string
  agent_id: string | null
  call_id: string | null
  caller_name: string | null
  caller_phone: string
  service: string | null
  preferred_times: string | null
  status: 'waiting' | 'offered' | 'booked' | 'removed'
  offered_at: string | null
  created_at: string
}

// ─── Team, messages, SMS ─────────────────────────────────────────────────────

export interface EscalationContact {
  id: string
  org_id: string
  name: string
  role: string | null
  /** E.164 */
  phone: string | null
  email: string | null
  /** The agent may transfer live calls to this person. */
  transfer_enabled: boolean
  notify_sms: boolean
  notify_email: boolean
  /** Receives urgent notifications. */
  is_on_call: boolean
  /** Plain-language rule: when should the agent route to this person. */
  conditions: string | null
  sort_order: number
  created_at: string
}

export type MessageUrgency = 'normal' | 'urgent'

export interface AgentMessage {
  id: string
  org_id: string
  agent_id: string | null
  call_id: string | null
  recipient_contact_id: string | null
  recipient_name: string | null
  caller_name: string | null
  caller_number: string | null
  callback_number: string | null
  body: string
  urgency: MessageUrgency
  status: 'new' | 'notified' | 'read' | 'done'
  notified_at: string | null
  created_at: string
}

export type SmsKind = 'confirmation' | 'reminder' | 'custom' | 'notification' | 'waitlist_offer' | 'inbound'

export interface SmsMessage {
  id: string
  org_id: string
  call_id: string | null
  booking_id: string | null
  direction: 'outbound' | 'inbound'
  kind: SmsKind
  to_number: string
  from_number: string
  body: string
  twilio_sid: string | null
  status: string
  error_code: string | null
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
  outcome_breakdown: Record<CallOutcome, number>
}

// ─── Call Filters ─────────────────────────────────────────────────────────────

export type CallFilters = {
  /** Matches caller number, summary and transcript text. */
  search: string
  status: 'all' | 'completed' | 'failed' | 'busy' | 'no-answer'
  direction: 'all' | 'inbound' | 'outbound'
  sentiment: 'all' | 'positive' | 'neutral' | 'negative'
  outcome: 'all' | CallOutcome
  tag: string
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
