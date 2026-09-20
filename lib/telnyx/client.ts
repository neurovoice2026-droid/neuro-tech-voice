// ─── Telnyx Client ───────────────────────────────────────────────────────────
// Telephony layer: phone numbers, call control, and the media stream that
// carries call audio to our orchestrator.
//
// This replaces both halves of the old setup at once — Twilio (which owned the
// numbers) and ElevenLabs' convai phone/agent endpoints (which owned the call
// itself). Telnyx now owns the whole leg: it rents the number, receives the
// call, and forks the audio to lib/orchestrator over a WebSocket.

import crypto from 'crypto'

const BASE = 'https://api.telnyx.com/v2'

export class TelnyxError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`Telnyx API error ${status} on ${path}: ${body}`)
    this.name = 'TelnyxError'
  }
}

export function isConfigured(): boolean {
  const key = process.env.TELNYX_API_KEY
  return !!key && key !== 'your-telnyx-api-key'
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    throw new TelnyxError(res.status, await res.text(), path)
  }

  // 202-with-empty-body is normal for call control actions.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return res.json() as Promise<T>
}

// Telnyx wraps every response in { data: ... }. Unwrapping here keeps that
// detail out of every call site.
async function unwrap<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request<{ data: T }>(method, path, body)
  return res?.data as T
}

// ─── Webhook signature ───────────────────────────────────────────────────────

/**
 * Telnyx signs webhooks with Ed25519 (asymmetric), not an HMAC shared secret.
 *
 * Two headers are sent: `telnyx-signature-ed25519` (base64 signature) and
 * `telnyx-timestamp` (unix seconds). The signed message is the timestamp and
 * the raw body joined by a literal pipe: `{timestamp}|{rawBody}`.
 *
 * TELNYX_PUBLIC_KEY is the base64 key from Mission Control → Keys &
 * Credentials → Public Key. It is a bare 32-byte Ed25519 key, which Node's
 * createPublicKey cannot ingest directly, so the fixed SPKI/DER prefix for
 * Ed25519 is prepended to turn it into a structure Node accepts.
 */
export function isWebhookConfigured(): boolean {
  const key = process.env.TELNYX_PUBLIC_KEY
  return !!key && key !== 'your-telnyx-public-key'
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export function verifyWebhookSignature(
  rawBody: string,
  signatureB64: string | null,
  timestamp: string | null,
  toleranceSeconds = 300
): boolean {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY
  if (!publicKeyB64 || !signatureB64 || !timestamp) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false

  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyB64, 'base64')]),
      format: 'der',
      type: 'spki',
    })

    // Ed25519 verification takes a null algorithm — the curve implies it.
    return crypto.verify(
      null,
      Buffer.from(`${timestamp}|${rawBody}`),
      key,
      Buffer.from(signatureB64, 'base64')
    )
  } catch {
    return false
  }
}

// ─── Call control ────────────────────────────────────────────────────────────

export interface TelnyxCallPayload {
  call_control_id: string
  call_leg_id: string
  call_session_id: string
  connection_id: string
  from: string
  to: string
  direction: 'incoming' | 'outgoing'
  state: string
  client_state?: string | null
  [key: string]: unknown
}

export interface TelnyxWebhookEvent {
  data: {
    event_type: string
    id: string
    occurred_at: string
    payload: TelnyxCallPayload
    record_type: string
  }
}

/**
 * Payload of a `call.transcription` event.
 *
 * `is_final` is the field that matters: interim results arrive repeatedly and
 * get revised, so replying to one means answering a sentence the caller had
 * not finished saying.
 */
export interface TelnyxTranscriptionPayload {
  call_control_id: string
  call_leg_id: string
  call_session_id: string
  connection_id: string
  transcription_data: {
    transcript: string
    confidence?: number
    is_final: boolean
  }
  client_state?: string | null
}

/** Media-stream parameters shared by answer() and dial(). */
export interface StreamConfig {
  /** WebSocket our orchestrator listens on, e.g. wss://voice.example.com/media */
  stream_url: string
  /** inbound_track is the caller's audio only — what the agent needs to hear. */
  stream_track?: 'inbound_track' | 'outbound_track' | 'both_tracks'
  /** 'rtp' is what allows us to push audio BACK into the call. */
  stream_bidirectional_mode?: 'rtp'
  stream_bidirectional_codec?: 'PCMU' | 'PCMA' | 'G722' | 'OPUS' | 'AMR-WB' | 'L16'
}

/**
 * Transport codec for the audio we push back into the call.
 *
 * This is the real quality ceiling on the call, above the TTS model. PCMU is
 * G.711 μ-law at 8kHz: everything above ~3.4kHz is discarded, which removes
 * most of the sibilance and air that make a synthesised voice sound present.
 * No TTS model can put that back.
 *
 * L16 is 16kHz linear PCM — twice the bandwidth, and Fish already generates at
 * that rate, so it costs nothing to produce and skips both the resampling and
 * the companding step.
 *
 * The default stays PCMU because it is universally supported and cannot fail
 * to negotiate. L16 is the upgrade worth testing first on any call path that
 * is not plain PSTN: set TELNYX_STREAM_CODEC=L16. If the carrier leg is
 * narrowband anyway (most mobile calls), the gain is limited to our own hop.
 */
export const DEFAULT_STREAM: Required<Omit<StreamConfig, 'stream_url'>> = {
  stream_track: 'inbound_track',
  stream_bidirectional_mode: 'rtp',
  stream_bidirectional_codec:
    (process.env.TELNYX_STREAM_CODEC as StreamConfig['stream_bidirectional_codec']) ?? 'PCMU',
}

export const calls = {
  /**
   * Answer an inbound call and immediately fork its audio to the orchestrator.
   * Starting the stream as part of the answer (rather than a separate
   * streaming_start afterwards) avoids a window where the caller is connected
   * but nothing is listening — that gap is audible as dead air.
   */
  answer(callControlId: string, stream: StreamConfig & { client_state?: string }) {
    return request<void>('POST', `/calls/${callControlId}/actions/answer`, {
      ...DEFAULT_STREAM,
      ...stream,
      ...(stream.client_state
        ? { client_state: Buffer.from(stream.client_state).toString('base64') }
        : {}),
    })
  },

  hangup(callControlId: string) {
    return request<void>('POST', `/calls/${callControlId}/actions/hangup`)
  },

  /** Start streaming on an already-answered call. */
  streamingStart(callControlId: string, stream: StreamConfig) {
    return request<void>('POST', `/calls/${callControlId}/actions/streaming_start`, {
      ...DEFAULT_STREAM,
      ...stream,
    })
  },

  streamingStop(callControlId: string) {
    return request<void>('POST', `/calls/${callControlId}/actions/streaming_stop`)
  },

  recordStart(callControlId: string, opts?: { channels?: 'single' | 'dual'; format?: 'wav' | 'mp3' }) {
    return request<void>('POST', `/calls/${callControlId}/actions/record_start`, {
      channels: opts?.channels ?? 'dual',
      format: opts?.format ?? 'mp3',
    })
  },

  recordStop(callControlId: string) {
    return request<void>('POST', `/calls/${callControlId}/actions/record_stop`)
  },

  /**
   * Start realtime transcription on the call.
   *
   * This replaces buffering the caller's audio and posting it to a batch ASR
   * endpoint after our own VAD decides they stopped. That round trip was the
   * hard floor on response latency (~800ms); here the engine does its own
   * endpointing and pushes `call.transcription` webhooks as it goes, so the
   * transcript is usually ready within a few hundred ms of the caller
   * finishing.
   *
   * `transcription_tracks: 'inbound'` is the default and the correct choice —
   * 'both' would feed the agent's own speech back in as if the caller had
   * said it.
   */
  transcriptionStart(
    callControlId: string,
    params: {
      engine?: 'Google' | 'Telnyx' | 'Deepgram' | 'Azure' | 'AssemblyAI' | 'Speechmatics' | 'Soniox'
      language?: string
      /** Partial hypotheses during speech. Not offered by every engine. */
      interim_results?: boolean
      transcription_tracks?: 'inbound' | 'outbound' | 'both'
      model?: string
      client_state?: string
    } = {}
  ) {
    return request<void>('POST', `/calls/${callControlId}/actions/transcription_start`, {
      transcription_engine: params.engine ?? 'Deepgram',
      transcription_tracks: params.transcription_tracks ?? 'inbound',
      interim_results: params.interim_results ?? false,
      ...(params.language ? { language: params.language } : {}),
      ...(params.model ? { model: params.model } : {}),
      ...(params.client_state
        ? { client_state: Buffer.from(params.client_state).toString('base64') }
        : {}),
    })
  },

  transcriptionStop(callControlId: string) {
    return request<void>('POST', `/calls/${callControlId}/actions/transcription_stop`)
  },

  transfer(callControlId: string, to: string, from?: string) {
    return request<void>('POST', `/calls/${callControlId}/actions/transfer`, {
      to,
      ...(from ? { from } : {}),
    })
  },

  /**
   * Place an outbound call. Returns the call_control_id used for every
   * subsequent action on this leg.
   */
  dial(params: {
    to: string
    from: string
    connection_id: string
    stream?: StreamConfig
    client_state?: string
    timeout_secs?: number
  }) {
    return unwrap<TelnyxCallPayload>('POST', '/calls', {
      to: params.to,
      from: params.from,
      connection_id: params.connection_id,
      ...(params.timeout_secs ? { timeout_secs: params.timeout_secs } : {}),
      ...(params.stream ? { ...DEFAULT_STREAM, ...params.stream } : {}),
      ...(params.client_state
        ? { client_state: Buffer.from(params.client_state).toString('base64') }
        : {}),
    })
  },
}

/** client_state round-trips through Telnyx base64-encoded; decode on receipt. */
export function decodeClientState(state: string | null | undefined): string | null {
  if (!state) return null
  try {
    return Buffer.from(state, 'base64').toString('utf8')
  } catch {
    return null
  }
}

// ─── Phone numbers ───────────────────────────────────────────────────────────

export interface AvailableNumber {
  phone_number: string
  region_information?: Array<{ region_type: string; region_name: string }>
  cost_information?: { monthly_cost: string; upfront_cost: string; currency: string }
  features?: Array<{ name: string }>
  [key: string]: unknown
}

export interface TelnyxPhoneNumber {
  id: string
  phone_number: string
  status: string
  connection_id?: string | null
  connection_name?: string | null
  customer_reference?: string | null
  [key: string]: unknown
}

export const phoneNumbers = {
  /**
   * Search purchasable numbers. `filter[country_code]` is mandatory on this
   * endpoint — a search without it is rejected rather than defaulted.
   */
  searchAvailable(params: {
    country_code: string
    locality?: string
    national_destination_code?: string
    limit?: number
    features?: Array<'voice' | 'sms' | 'mms' | 'fax' | 'emergency'>
  }) {
    const qs = new URLSearchParams()
    qs.set('filter[country_code]', params.country_code)
    if (params.locality) qs.set('filter[locality]', params.locality)
    if (params.national_destination_code) {
      qs.set('filter[national_destination_code]', params.national_destination_code)
    }
    qs.set('filter[limit]', String(params.limit ?? 20))
    for (const f of params.features ?? ['voice']) {
      qs.append('filter[features][]', f)
    }
    return unwrap<AvailableNumber[]>('GET', `/available_phone_numbers?${qs.toString()}`)
  },

  /** Buy one or more numbers found via searchAvailable. */
  order(phoneNumbers: string[], connectionId?: string) {
    return unwrap<{ id: string; phone_numbers: Array<{ id: string; phone_number: string }>; status: string }>(
      'POST',
      '/number_orders',
      {
        phone_numbers: phoneNumbers.map((n) => ({ phone_number: n })),
        ...(connectionId ? { connection_id: connectionId } : {}),
      }
    )
  },

  list(params?: { page_size?: number; page_number?: number }) {
    const qs = new URLSearchParams()
    qs.set('page[size]', String(params?.page_size ?? 50))
    qs.set('page[number]', String(params?.page_number ?? 1))
    return unwrap<TelnyxPhoneNumber[]>('GET', `/phone_numbers?${qs.toString()}`)
  },

  get(numberId: string) {
    return unwrap<TelnyxPhoneNumber>('GET', `/phone_numbers/${numberId}`)
  },

  /**
   * Point a number at the Voice API application that will receive its
   * webhooks. Without a connection_id the number rings nowhere — this is the
   * step that actually wires an inbound call to our agent.
   */
  update(numberId: string, params: { connection_id?: string; customer_reference?: string }) {
    return unwrap<TelnyxPhoneNumber>('PATCH', `/phone_numbers/${numberId}`, params)
  },

  release(numberId: string) {
    return request<void>('DELETE', `/phone_numbers/${numberId}`)
  },
}
