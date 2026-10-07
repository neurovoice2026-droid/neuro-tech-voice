// Shapes of GET/POST /api/agent/web-session (lib/voice-providers/web-test.ts),
// shared by the test panel and the lazily loaded session view. Client-safe.

export type WebTestMode = 'voice' | 'text'

/** Mirrors WEB_TEST_MIN_SESSION_SECONDS: below this the server refuses a new session. */
export const MIN_SESSION_SECONDS = 30

export interface WebTestPrivacy {
  record_audio: boolean
  /** -1 = kept until deleted, 0 = deleted right after the call. */
  retention_days: number
}

export interface WebTestAvailability {
  available: boolean
  reason: 'agent_missing' | 'agent_inactive' | 'agent_not_ready' | 'not_configured' | null
  text_available: boolean
  max_session_seconds: number
  /** Unpaid orgs: 0 also when their seconds budget is spent or browser tests are blocked. */
  sessions_left: number | null
  /** Seconds left in the org's budget (lifetime when unpaid, today when paid; null: unknown). */
  seconds_left: number | null
  /** Paused after a session far longer than the cap (a platform admin turns them back on). */
  blocked: boolean
  privacy: WebTestPrivacy | null
}

export interface WebTestSessionGrant {
  conversation_token: string
  conversation_id: string | null
  call_id: string | null
  mode: WebTestMode
  connection_type: 'webrtc'
  /** SDK serverLocation: the data-residency environment the token was minted in. */
  server_location: 'us' | 'eu-residency' | 'in-residency'
  dynamic_variables: Record<string, string>
  max_session_seconds: number
  sessions_left: number | null
  seconds_left: number | null
  privacy: WebTestPrivacy
}
