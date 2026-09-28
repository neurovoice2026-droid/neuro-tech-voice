// Environment parsing for the gateway. Read once at start-up; tests build a
// config object directly so every provider base URL can point at a mock.
//
// Rules shared with the app (lib/env.ts): values are trimmed, placeholders
// like `your-key` or `<changeme>` count as unset, and the gateway secret must
// be at least 32 characters or signatures would not match the app's.

export const MIN_GATEWAY_SECRET_LENGTH = 32
export const CARTESIA_API_VERSION = '2026-08-14'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Latency and lifecycle knobs. Production values are the defaults; tests shrink them. */
export interface GatewayTimings {
  /** Twilio must send `start` within this after the socket opens. */
  twilioStartTimeoutMs: number
  /** Provider WebSocket handshakes (Cartesia/ElevenLabs TTS and STT). */
  componentConnectTimeoutMs: number
  /** Agent WebSockets (Cartesia Managed Agents, ElevenLabs agent). */
  agentConnectTimeoutMs: number
  /** Cartesia requires session_create within 10 s; we wait this long for session_ready. */
  managedReadyTimeoutMs: number
  /** Reconnect an idle Cartesia TTS socket before the server's 5 min idle close. */
  ttsIdleReconnectMs: number
  /** Manual STT: silence after speech before we send `finalize`. */
  manualFinalizeSilenceMs: number
  /** Inject silence frames when the channel sends no audio for this long. */
  silenceFillAfterMs: number
  /** Drop queued caller audio older than this when a provider stalls. */
  maxAudioLagMs: number
  /** Seconds of caller audio kept for replay into a replacement STT. */
  sttReplayBufferMs: number
  /** Warn this long before max duration. */
  wrapUpBeforeEndMs: number
  /** How long we wait for Twilio `stop` after asking the app to hang up. */
  hangupGraceMs: number
  /** Outbound voicemail heuristic: first caller utterance longer than this is a greeting machine. */
  voicemailSpeechMs: number
  /** Graceful shutdown: wait at most this long for calls to finish. */
  shutdownDrainMs: number
}

export interface GatewayConfig {
  port: number
  host: string
  appUrl: string
  gatewaySecret: string
  logLevel: LogLevel
  maxConcurrentCalls: number
  /** Browser test-call origins allowed to open /browser; empty = any origin (token still required). */
  browserAllowedOrigins: string[]
  /** Bearer token that unlocks the detailed /health body; null = status only for everyone. */
  healthDetailsToken: string | null
  cartesia: {
    apiKey: string | null
    ttsModel: string
    /** https base, e.g. https://api.cartesia.ai (ws base is derived). */
    apiBase: string
    version: string
  }
  openai: {
    apiKey: string | null
    model: string
    /** null = SDK default (api.openai.com). */
    baseUrl: string | null
  }
  elevenlabs: {
    apiKey: string | null
    apiBase: string
    ttsModel: string
  }
  timings: GatewayTimings
}

export const DEFAULT_TIMINGS: GatewayTimings = {
  // Twilio sends `start` right after `connected`; an idle unauthenticated socket is dropped quickly.
  twilioStartTimeoutMs: 5_000,
  componentConnectTimeoutMs: 3_000,
  agentConnectTimeoutMs: 5_000,
  managedReadyTimeoutMs: 10_000,
  ttsIdleReconnectMs: 240_000,
  manualFinalizeSilenceMs: 700,
  silenceFillAfterMs: 300,
  maxAudioLagMs: 2_000,
  sttReplayBufferMs: 2_000,
  wrapUpBeforeEndMs: 30_000,
  hangupGraceMs: 5_000,
  voicemailSpeechMs: 5_000,
  shutdownDrainMs: 30_000,
}

const PLACEHOLDER = /^(your[-_].*|<.*>|changeme|placeholder|replaceme|todo|tbd|xxx)$/i

function clean(value: string | undefined): string | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  if (!trimmed || PLACEHOLDER.test(trimmed)) return null
  return trimmed
}

function intFrom(value: string | undefined, fallback: number, min: number, max: number): number {
  const raw = clean(value)
  if (raw === null) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ConfigError(`must be an integer between ${min} and ${max}`)
  }
  return n
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * These bases receive provider keys or full call transcripts, so plain http is
 * refused except on loopback (local development and test proxies).
 */
function httpsBase(value: string | null, fallback: string, name: string): string {
  const raw = value ?? fallback
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ConfigError(`${name} must be an absolute URL`)
  }
  const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  if (!allowed) throw new ConfigError(`${name} must use https (http only for localhost)`)
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Throws ConfigError with a message naming the variable (never its value). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const secret = clean(env.VOICE_GATEWAY_SECRET)
  if (!secret || secret.length < MIN_GATEWAY_SECRET_LENGTH) {
    throw new ConfigError(`VOICE_GATEWAY_SECRET is required and must be at least ${MIN_GATEWAY_SECRET_LENGTH} characters`)
  }
  const appUrlRaw = clean(env.APP_URL)
  if (!appUrlRaw) throw new ConfigError('APP_URL is required (https base URL of the app)')
  const appUrl = httpsBase(/^https?:\/\//i.test(appUrlRaw) ? appUrlRaw : `https://${appUrlRaw}`, '', 'APP_URL')

  const level = (clean(env.LOG_LEVEL) ?? 'info').toLowerCase()
  const logLevel: LogLevel = level === 'debug' || level === 'warn' || level === 'error' ? level : 'info'

  let port: number
  let maxConcurrentCalls: number
  let shutdownDrainMs: number
  try {
    port = intFrom(env.PORT, 8080, 1, 65535)
  } catch (e) {
    throw new ConfigError(`PORT ${(e as Error).message}`)
  }
  try {
    maxConcurrentCalls = intFrom(env.MAX_CONCURRENT_CALLS, 100, 1, 10_000)
  } catch (e) {
    throw new ConfigError(`MAX_CONCURRENT_CALLS ${(e as Error).message}`)
  }
  try {
    shutdownDrainMs = intFrom(env.SHUTDOWN_DRAIN_SECONDS, 30, 0, 600) * 1000
  } catch (e) {
    throw new ConfigError(`SHUTDOWN_DRAIN_SECONDS ${(e as Error).message}`)
  }

  const origins = (clean(env.BROWSER_ALLOWED_ORIGINS) ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  // The app's own origin is always allowed when a list is configured.
  if (origins.length > 0) origins.push(new URL(appUrl).origin)

  return {
    port,
    host: clean(env.HOST) ?? '0.0.0.0',
    appUrl,
    gatewaySecret: secret,
    logLevel,
    maxConcurrentCalls,
    browserAllowedOrigins: [...new Set(origins)],
    healthDetailsToken: (() => {
      const token = clean(env.HEALTH_DETAILS_TOKEN)
      if (token !== null && token.length < 24) throw new ConfigError('HEALTH_DETAILS_TOKEN must be at least 24 characters when set')
      return token
    })(),
    cartesia: {
      apiKey: clean(env.CARTESIA_API_KEY),
      ttsModel: clean(env.CARTESIA_TTS_MODEL) ?? 'sonic-3.6-2026-08-27',
      apiBase: httpsBase(clean(env.CARTESIA_API_BASE), 'https://api.cartesia.ai', 'CARTESIA_API_BASE'),
      version: CARTESIA_API_VERSION,
    },
    openai: {
      apiKey: clean(env.OPENAI_API_KEY),
      model: clean(env.OPENAI_VOICE_MODEL) ?? 'gpt-5.6-luna',
      baseUrl: clean(env.OPENAI_BASE_URL) === null ? null : httpsBase(clean(env.OPENAI_BASE_URL), '', 'OPENAI_BASE_URL'),
    },
    elevenlabs: {
      apiKey: clean(env.ELEVENLABS_API_KEY),
      apiBase: httpsBase(clean(env.ELEVENLABS_API_BASE), 'https://api.elevenlabs.io', 'ELEVENLABS_API_BASE'),
      ttsModel: clean(env.ELEVENLABS_TTS_MODEL) ?? 'eleven_flash_v2_5',
    },
    timings: { ...DEFAULT_TIMINGS, shutdownDrainMs },
  }
}

/** ws(s):// base for an http(s):// API base. */
export function wsBase(httpBase: string): string {
  return httpBase.replace(/^http/i, 'ws')
}
