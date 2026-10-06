// Voice platform configuration: one place that reads env, validates it, and
// reports problems WITHOUT ever returning secret values (only presence/shape).
// Used by instrumentation.ts at startup and by the admin diagnostics endpoint.

import { parseJson } from '@/lib/util/json'
import type { VoiceProvider } from './errors'

export interface ConfigProblem {
  key: string
  severity: 'error' | 'warning'
  message: string
}

const PLACEHOLDER = /^(|your-.*|changeme|todo|xxx+)$/i

function present(name: string): boolean {
  const v = (process.env[name] ?? '').trim()
  return v.length > 0 && !PLACEHOLDER.test(v)
}

function str(name: string): string | null {
  return present(name) ? (process.env[name] as string).trim() : null
}

/** Public HTTPS base URL Twilio and providers use to reach this app. */
export function publicBaseUrl(): string | null {
  const raw = str('VOICE_PUBLIC_BASE_URL') ?? str('NEXT_PUBLIC_APP_URL')
  // An unparsable value is reported by validateVoiceConfig().
  if (!raw || !URL.canParse(raw)) return null
  const u = new URL(raw)
  return `${u.protocol}//${u.host}`
}

export function forcedProvider(): 'auto' | VoiceProvider {
  const v = (process.env.VOICE_FORCE_PROVIDER ?? 'auto').trim().toLowerCase()
  return v === 'elevenlabs' || v === 'cartesia' ? v : 'auto'
}

/** Platform-wide switch for provider fallback (orgs can also opt out). */
export function platformFallbackEnabled(): boolean {
  return (process.env.VOICE_FALLBACK_ENABLED ?? 'true').trim().toLowerCase() !== 'false'
}

export function earlyFailureWindowSeconds(): number {
  const v = Number(process.env.VOICE_EARLY_FAILURE_WINDOW_SECONDS ?? '6')
  return Number.isFinite(v) && v >= 0 && v <= 30 ? v : 6
}

export function cartesiaSip(): { domain: string; transport: 'tls' | 'tcp'; username: string | null; password: string | null } {
  const transport = (process.env.CARTESIA_SIP_TRANSPORT ?? 'tls').trim().toLowerCase() === 'tcp' ? 'tcp' : 'tls'
  const domain = (str('CARTESIA_SIP_DOMAIN') ?? 'sip.cartesia.ai').replace(/^sips?:/i, '')
  return { domain, transport, username: str('CARTESIA_SIP_USERNAME'), password: str('CARTESIA_SIP_PASSWORD') }
}

export function cartesiaAgentLlm(): string {
  const v = (process.env.CARTESIA_AGENT_LLM ?? '').trim()
  return /^[a-z0-9][a-z0-9.@_-]{1,63}$/i.test(v) ? v : 'gpt-5.4-mini'
}

/** Optional explicit fallback voices per language: {"ro":"<cartesia voice id>", ...}. */
export function cartesiaFallbackVoices(): Record<string, string> {
  const raw = process.env.CARTESIA_FALLBACK_VOICES
  if (!raw) return {}
  // Invalid JSON is reported by validateVoiceConfig(); the automatic voice choice applies.
  const parsed = parseJson(raw)
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed.value as Record<string, unknown>)) {
    if (/^[a-z]{2}$/.test(k) && typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v)) out[k] = v
  }
  return out
}

export function voiceTokenSecret(): string | null {
  const v = str('VOICE_TOKEN_SECRET')
  return v && v.length >= 32 ? v : null
}

export function libraryMinNoticeDays(): number | undefined {
  const raw = process.env.VOICE_LIBRARY_MIN_NOTICE_DAYS
  if (raw === undefined || raw === '') return 30
  const v = Number(raw)
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) || undefined : 30
}

export function allowUnsignedWebhooks(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true'
}

export interface VoiceConfigSummary {
  publicBaseUrl: string | null
  routing: { forcedProvider: 'auto' | VoiceProvider; fallbackEnabled: boolean; earlyFailureWindowSeconds: number }
  elevenlabs: { apiKey: boolean; webhookSecret: boolean; postCallWebhookId: boolean; llmOverride: boolean }
  cartesia: { apiKey: boolean; webhookSecret: boolean; sipCredentials: boolean; toolSecret: boolean; fallbackVoices: number }
  twilio: { accountSid: boolean; authToken: boolean }
  security: { voiceTokenSecret: boolean; adminToken: boolean; adminUsers: boolean; cronSecret: boolean }
  supabase: { serviceRole: boolean }
}

export function summarizeVoiceConfig(): VoiceConfigSummary {
  return {
    publicBaseUrl: publicBaseUrl(),
    routing: { forcedProvider: forcedProvider(), fallbackEnabled: platformFallbackEnabled(), earlyFailureWindowSeconds: earlyFailureWindowSeconds() },
    elevenlabs: {
      apiKey: present('ELEVENLABS_API_KEY'),
      webhookSecret: present('ELEVENLABS_WEBHOOK_SECRET'),
      postCallWebhookId: present('ELEVENLABS_POST_CALL_WEBHOOK_ID'),
      llmOverride: present('ELEVENLABS_LLM'),
    },
    cartesia: {
      apiKey: present('CARTESIA_API_KEY'),
      // Shorter secrets are rejected by platform-resources (webhook not created).
      webhookSecret: (process.env.CARTESIA_WEBHOOK_SECRET ?? '').trim().length >= 24,
      sipCredentials: present('CARTESIA_SIP_USERNAME') && present('CARTESIA_SIP_PASSWORD'),
      toolSecret: (process.env.CARTESIA_TOOL_SECRET ?? '').trim().length >= 24,
      fallbackVoices: Object.keys(cartesiaFallbackVoices()).length,
    },
    twilio: { accountSid: present('TWILIO_ACCOUNT_SID'), authToken: present('TWILIO_AUTH_TOKEN') },
    security: {
      voiceTokenSecret: voiceTokenSecret() !== null,
      adminToken: (process.env.ADMIN_API_TOKEN ?? '').length >= 32,
      adminUsers: present('PLATFORM_ADMIN_USER_IDS'),
      cronSecret: (process.env.CRON_SECRET ?? '').length >= 16,
    },
    supabase: { serviceRole: present('SUPABASE_SERVICE_ROLE_KEY') },
  }
}

/** Problems that would make a feature silently not work. Never includes values. */
export function validateVoiceConfig(): ConfigProblem[] {
  const s = summarizeVoiceConfig()
  const problems: ConfigProblem[] = []
  const err = (key: string, message: string) => problems.push({ key, severity: 'error', message })
  const warn = (key: string, message: string) => problems.push({ key, severity: 'warning', message })

  const rawFallbackVoices = process.env.CARTESIA_FALLBACK_VOICES
  if (rawFallbackVoices && !parseJson(rawFallbackVoices).ok) warn('CARTESIA_FALLBACK_VOICES', 'Not valid JSON: the automatic per-language voice is used instead.')
  if (!s.publicBaseUrl) err('VOICE_PUBLIC_BASE_URL', 'No public base URL: Twilio/provider webhooks cannot be configured or verified.')
  else if (!s.publicBaseUrl.startsWith('https://') && process.env.NODE_ENV === 'production') err('VOICE_PUBLIC_BASE_URL', 'Public base URL must be HTTPS in production.')
  if (!s.supabase.serviceRole) err('SUPABASE_SERVICE_ROLE_KEY', 'Webhooks, call routing and provider sync need the service-role key.')
  if (!s.twilio.accountSid || !s.twilio.authToken) err('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN', 'Twilio is not configured: no inbound routing, request validation or outbound calls.')
  if (!s.elevenlabs.apiKey) err('ELEVENLABS_API_KEY', 'ElevenLabs (primary provider) is not configured.')
  if (s.elevenlabs.apiKey && !s.elevenlabs.webhookSecret) err('ELEVENLABS_WEBHOOK_SECRET', 'Post-call webhooks will be rejected (signature cannot be verified).')
  if (s.elevenlabs.apiKey && !s.elevenlabs.postCallWebhookId) warn('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'Agents will rely on the workspace-level post-call webhook setting.')
  if (!s.security.voiceTokenSecret) err('VOICE_TOKEN_SECRET', 'Missing or shorter than 32 chars: call tokens (transfer tool, stream fallback) cannot be signed.')
  if (s.routing.fallbackEnabled) {
    if (!s.cartesia.apiKey) warn('CARTESIA_API_KEY', 'Cartesia fallback is enabled but not configured: calls fail over to the apology/human path only.')
    if (s.cartesia.apiKey && !s.cartesia.sipCredentials) err('CARTESIA_SIP_USERNAME/CARTESIA_SIP_PASSWORD', 'Cartesia is configured but the SIP trunk credentials are missing: fallback calls cannot be connected.')
    if (s.cartesia.apiKey && !s.cartesia.webhookSecret) warn('CARTESIA_WEBHOOK_SECRET', 'Missing or shorter than 24 chars: Cartesia call events will only be collected by polling.')
    if (s.cartesia.apiKey && !s.cartesia.toolSecret) warn('CARTESIA_TOOL_SECRET', 'Missing or shorter than 24 chars: the fallback agent cannot fetch per-call context (after-hours flag).')
  }
  if (!s.security.cronSecret) warn('CRON_SECRET', 'Scheduled maintenance (health checks, webhook retries, Cartesia polling) is not protected/enabled.')
  if (!s.security.adminToken && !s.security.adminUsers) warn('ADMIN_API_TOKEN/PLATFORM_ADMIN_USER_IDS', 'No platform admin configured: diagnostics and reconciliation endpoints are unreachable.')
  if (s.routing.forcedProvider !== 'auto') warn('VOICE_FORCE_PROVIDER', `Kill switch active: every new routed call goes to ${s.routing.forcedProvider}.`)
  return problems
}
