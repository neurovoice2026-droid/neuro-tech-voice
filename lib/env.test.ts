import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appUrl,
  env,
  envNumber,
  envString,
  gatewayWsUrl,
  isCartesiaConfigured,
  isGatewayConfigured,
  isGoogleConfigured,
  isPlaceholderValue,
  isResendConfigured,
  isStripeConfigured,
  isSupabaseAdminConfigured,
  isTwilioConfigured,
  isUpstashConfigured,
  voicePipelineModeOverride,
} from './env'

const SECRET = 'a'.repeat(48)

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('env getters', () => {
  it('reads lazily, so later changes are visible', () => {
    vi.stubEnv('CARTESIA_API_KEY', '')
    expect(env.CARTESIA_API_KEY).toBeUndefined()
    vi.stubEnv('CARTESIA_API_KEY', 'sk_car_live')
    expect(env.CARTESIA_API_KEY).toBe('sk_car_live')
  })

  it('trims values and treats empty, whitespace and placeholders as unset', () => {
    vi.stubEnv('OPENAI_API_KEY', '  sk-real  ')
    expect(env.OPENAI_API_KEY).toBe('sk-real')
    for (const value of ['', '   ', 'your-openai-api-key', 'YOUR_KEY', '<paste here>', 'changeme', 'xxxx']) {
      vi.stubEnv('OPENAI_API_KEY', value)
      expect(env.OPENAI_API_KEY, value).toBeUndefined()
    }
  })

  it('is read-only', () => {
    expect(() => {
      ;(env as Record<string, unknown>).OPENAI_API_KEY = 'x'
    }).toThrow()
  })

  it('recognises placeholder values', () => {
    expect(isPlaceholderValue('your-twilio-auth-token')).toBe(true)
    expect(isPlaceholderValue('yourcompany-key')).toBe(false)
    expect(isPlaceholderValue('sk_live_123')).toBe(false)
  })

  it('envString and envNumber fall back', () => {
    vi.stubEnv('CARTESIA_TTS_MODEL', '')
    expect(envString('CARTESIA_TTS_MODEL', 'sonic-3.6-2026-08-27')).toBe('sonic-3.6-2026-08-27')
    vi.stubEnv('CARTESIA_MONTHLY_CREDITS', '8_000_000')
    expect(envNumber('CARTESIA_MONTHLY_CREDITS', 1)).toBe(8_000_000)
    vi.stubEnv('CARTESIA_MONTHLY_CREDITS', 'lots')
    expect(envNumber('CARTESIA_MONTHLY_CREDITS', 42)).toBe(42)
  })
})

describe('configuration checks', () => {
  it('supabase admin needs url and service role key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(isSupabaseAdminConfigured()).toBe(false)
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
    expect(isSupabaseAdminConfigured()).toBe(true)
  })

  it('cartesia ignores placeholders', () => {
    vi.stubEnv('CARTESIA_API_KEY', 'your-cartesia-api-key')
    expect(isCartesiaConfigured()).toBe(false)
  })

  it('twilio needs an AC account sid and a token', () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'your-twilio-account-sid')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
    expect(isTwilioConfigured()).toBe(false)
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123')
    expect(isTwilioConfigured()).toBe(true)
  })

  it('stripe needs a secret or restricted key', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'pk_live_123')
    expect(isStripeConfigured()).toBe(false)
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_live_123')
    expect(isStripeConfigured()).toBe(true)
  })

  it('upstash, google and resend need both values', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://eu1.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    expect(isUpstashConfigured()).toBe(false)
    vi.stubEnv('GOOGLE_CLIENT_ID', 'id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret')
    expect(isGoogleConfigured()).toBe(true)
    vi.stubEnv('RESEND_API_KEY', 're_123')
    vi.stubEnv('RESEND_FROM_EMAIL', '')
    expect(isResendConfigured()).toBe(false)
  })

  it('gateway needs a valid url and a secret of at least 32 characters', () => {
    vi.stubEnv('VOICE_GATEWAY_URL', 'wss://gw.example.com')
    vi.stubEnv('VOICE_GATEWAY_SECRET', 'short')
    expect(isGatewayConfigured()).toBe(false)
    vi.stubEnv('VOICE_GATEWAY_SECRET', SECRET)
    expect(isGatewayConfigured()).toBe(true)
    vi.stubEnv('VOICE_GATEWAY_URL', 'ftp://gw.example.com')
    expect(isGatewayConfigured()).toBe(false)
    vi.stubEnv('VOICE_GATEWAY_URL', 'not a url')
    expect(isGatewayConfigured()).toBe(false)
  })
})

describe('appUrl', () => {
  it('strips trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com///')
    expect(appUrl()).toBe('https://app.example.com')
  })

  it('adds https to a bare host', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'app.example.com')
    expect(appUrl()).toBe('https://app.example.com')
  })

  it('falls back per environment', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(appUrl()).toBe('https://neurotechvoice.com')
    vi.stubEnv('NODE_ENV', 'development')
    expect(appUrl()).toBe('http://localhost:3000')
  })
})

describe('gatewayWsUrl', () => {
  it('throws when the gateway is not configured', () => {
    vi.stubEnv('VOICE_GATEWAY_URL', '')
    vi.stubEnv('VOICE_GATEWAY_SECRET', SECRET)
    expect(() => gatewayWsUrl('/twilio')).toThrow(/not configured/)
  })

  it('joins the path and converts https to wss', () => {
    vi.stubEnv('VOICE_GATEWAY_SECRET', SECRET)
    vi.stubEnv('VOICE_GATEWAY_URL', 'wss://gw.example.com/')
    expect(gatewayWsUrl('/twilio')).toBe('wss://gw.example.com/twilio')
    vi.stubEnv('VOICE_GATEWAY_URL', 'https://gw.example.com/voice/')
    expect(gatewayWsUrl('/browser')).toBe('wss://gw.example.com/voice/browser')
    vi.stubEnv('VOICE_GATEWAY_URL', 'http://localhost:8080')
    expect(gatewayWsUrl('/browser')).toBe('ws://localhost:8080/browser')
  })
})

describe('voicePipelineModeOverride', () => {
  it('returns null for auto and unset', () => {
    vi.stubEnv('VOICE_PIPELINE_MODE', '')
    expect(voicePipelineModeOverride()).toBeNull()
    vi.stubEnv('VOICE_PIPELINE_MODE', 'auto')
    expect(voicePipelineModeOverride()).toBeNull()
  })

  it('returns a valid mode, case-insensitively', () => {
    vi.stubEnv('VOICE_PIPELINE_MODE', 'ElevenLabs')
    expect(voicePipelineModeOverride()).toBe('elevenlabs')
    vi.stubEnv('VOICE_PIPELINE_MODE', 'cartesia_managed')
    expect(voicePipelineModeOverride()).toBe('cartesia_managed')
  })

  it('ignores unknown values with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('VOICE_PIPELINE_MODE', 'cartesia')
    expect(voicePipelineModeOverride()).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })
})
