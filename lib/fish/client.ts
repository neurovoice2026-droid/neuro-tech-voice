// ─── Fish Audio Client ───────────────────────────────────────────────────────
// Voice layer: TTS, ASR and voice models (the catalogue the dashboard browses).
//
// Fish Audio replaces ONLY the voice half of what ElevenLabs used to do here.
// It has no agents, telephony, knowledge base or conversation storage — those
// live in lib/telnyx/* and lib/orchestrator/* now. Don't add call-shaped
// concepts to this file; it synthesises and transcribes audio, nothing else.

const BASE = 'https://api.fish.audio'

// ─── Models ──────────────────────────────────────────────────────────────────
// Model choice here is not free-form; two constraints narrow it, and one of
// them is genuinely unresolved in Fish's own documentation.
//
//   1. `s1` covers 13 languages and Romanian is not among them. It is unusable
//      for this product regardless of any other property.
//
//   2. Whether `s2.1-pro` works on the live WebSocket endpoint is CONTRADICTED
//      between two Fish documents:
//        - the /v1/tts/live API reference enumerates `model` as `s1 | s2-pro`,
//          which excludes s2.1-pro;
//        - the "choosing a model" guide recommends s2.1-pro for production
//          precisely because it has TTFA guarantees, alongside WebSocket
//          streaming.
//
// Rather than pick a reading, the realtime client requests PREFERRED and
// transparently falls back to FALLBACK if the server rejects the handshake —
// see lib/fish/realtime.ts. That way the better model is used wherever it is
// actually accepted, and a call never fails because a doc was stale.
export const TTS_MODEL_REALTIME_PREFERRED = 's2.1-pro'
export const TTS_MODEL_REALTIME_FALLBACK = 's2-pro'

/** Non-realtime paths (voice previews) have no such constraint. */
export const TTS_MODEL_STANDARD = 's2.1-pro'

export class FishAudioError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`Fish Audio API error ${status} on ${path}: ${body}`)
    this.name = 'FishAudioError'
  }
}

export function isConfigured(): boolean {
  const key = process.env.FISH_AUDIO_API_KEY
  return !!key && key !== 'your-fish-audio-api-key'
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.FISH_AUDIO_API_KEY!}` }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...authHeader(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    throw new FishAudioError(res.status, await res.text(), path)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return res.text() as unknown as T
}

async function requestFormData<T>(
  method: string,
  path: string,
  formData: FormData
): Promise<T> {
  // No Content-Type header here on purpose — fetch sets it with the multipart
  // boundary, and overriding it produces a body the server can't parse.
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeader(),
    body: formData,
  })

  if (!res.ok) {
    throw new FishAudioError(res.status, await res.text(), path)
  }

  return res.json() as Promise<T>
}

// ─── Voice models (the "voices" the dashboard shows) ─────────────────────────

// Note the field name: Fish returns Mongo-style `_id`, not `id`. Everything
// downstream (agents.voice_id, the TTS `reference_id` field) stores this value.
export interface FishModelSample {
  title?: string
  text?: string
  task_id?: string
  /** URL to a rendered preview clip — this is what the UI plays. */
  audio?: string
}

export interface FishModel {
  _id: string
  type: 'tts' | 'svc'
  title: string
  description?: string | null
  cover_image?: string | null
  state: 'created' | 'training' | 'trained' | 'failed'
  tags: string[]
  languages: string[]
  visibility: 'public' | 'unlist' | 'private'
  created_at?: string
  updated_at?: string
  like_count?: number
  mark_count?: number
  shared_count?: number
  task_count?: number
  samples?: FishModelSample[]
  author?: { _id: string; nickname?: string; avatar?: string }
  [key: string]: unknown
}

export interface ListModelsParams {
  /** 1–100. Fish's own default is 10, which is too small for a picker. */
  page_size?: number
  page_number?: number
  title?: string
  tag?: string | string[]
  /** true → only models owned by our workspace (i.e. cloned voices). */
  self?: boolean
  author_id?: string
  language?: string | string[]
  sort_by?: 'score' | 'task_count' | 'created_at'
}

export interface ListModelsResponse {
  total: number
  items: FishModel[]
  has_more: boolean
  max_offset?: number
  window_limited?: boolean
  total_is_exact?: boolean
}

export const models = {
  list(params?: ListModelsParams) {
    const qs = new URLSearchParams()
    qs.set('page_size', String(Math.min(params?.page_size ?? 100, 100)))
    if (params?.page_number) qs.set('page_number', String(params.page_number))
    if (params?.title) qs.set('title', params.title)
    if (params?.self) qs.set('self', 'true')
    if (params?.author_id) qs.set('author_id', params.author_id)
    if (params?.sort_by) qs.set('sort_by', params.sort_by)
    // tag and language repeat rather than comma-join — they're array params.
    for (const t of toArray(params?.tag)) qs.append('tag', t)
    for (const l of toArray(params?.language)) qs.append('language', l)
    return request<ListModelsResponse>('GET', `/model?${qs.toString()}`)
  },

  get(modelId: string) {
    return request<FishModel>('GET', `/model/${modelId}`)
  },

  /**
   * Clone a voice from 1–20 audio samples.
   *
   * `type` and `train_mode` are fixed constants in Fish's schema — they are
   * required fields but only accept one value each, so they're not parameters.
   * `cover_image` is required when visibility is public; we default to private
   * precisely so a customer's cloned voice never lands in the public library.
   */
  create(params: {
    title: string
    voices: File[]
    description?: string
    texts?: string[]
    tags?: string[]
    visibility?: 'public' | 'unlist' | 'private'
    enhance_audio_quality?: boolean
  }) {
    const fd = new FormData()
    fd.append('type', 'tts')
    fd.append('train_mode', 'fast')
    fd.append('title', params.title)
    fd.append('visibility', params.visibility ?? 'private')
    if (params.description) fd.append('description', params.description)
    if (params.enhance_audio_quality !== undefined) {
      fd.append('enhance_audio_quality', String(params.enhance_audio_quality))
    }
    for (const v of params.voices) fd.append('voices', v, v.name)
    for (const t of params.texts ?? []) fd.append('texts', t)
    for (const t of params.tags ?? []) fd.append('tags', t)
    return requestFormData<FishModel>('POST', '/model', fd)
  },

  update(modelId: string, params: { title?: string; description?: string; visibility?: string }) {
    return request<FishModel>('PATCH', `/model/${modelId}`, params)
  },

  delete(modelId: string) {
    return request<void>('DELETE', `/model/${modelId}`)
  },
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

// ─── Text-to-Speech (REST) ───────────────────────────────────────────────────

export interface TTSOptions {
  /** Voice model id (Fish `_id`). Their API calls this `reference_id`. */
  voiceId?: string | null
  model?: string
  format?: 'wav' | 'pcm' | 'mp3' | 'opus'
  sampleRate?: number
  mp3Bitrate?: 64 | 128 | 192
  /** 'low' trades a little quality for time-to-first-audio. */
  latency?: 'low' | 'normal' | 'balanced'
  /** 0.5–2.0 speaking rate; 1 is natural. */
  speed?: number
  volume?: number
  temperature?: number
  topP?: number
}

/**
 * One-shot synthesis. Used for voice previews and any pre-rendered prompt —
 * NOT for live call audio, which streams over the WebSocket path instead so
 * the caller doesn't wait for the whole utterance to render.
 */
export async function textToSpeech(
  text: string,
  opts: TTSOptions = {}
): Promise<ArrayBuffer> {
  const body: Record<string, unknown> = {
    text,
    format: opts.format ?? 'mp3',
    latency: opts.latency ?? 'normal',
    normalize: true,
  }
  if (opts.voiceId) body.reference_id = opts.voiceId
  if (opts.sampleRate) body.sample_rate = opts.sampleRate
  if (opts.mp3Bitrate) body.mp3_bitrate = opts.mp3Bitrate
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.topP !== undefined) body.top_p = opts.topP
  if (opts.speed !== undefined || opts.volume !== undefined) {
    body.prosody = {
      ...(opts.speed !== undefined ? { speed: opts.speed } : {}),
      ...(opts.volume !== undefined ? { volume: opts.volume } : {}),
    }
  }

  const res = await fetch(`${BASE}/v1/tts`, {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': 'application/json',
      // Model selection is a HEADER on this endpoint, not a body field.
      // Sending it in the body silently gets you the account default.
      model: opts.model ?? TTS_MODEL_STANDARD,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new FishAudioError(res.status, await res.text(), '/v1/tts')
  }

  return res.arrayBuffer()
}

// ─── Speech-to-Text ──────────────────────────────────────────────────────────

export interface ASRSegment {
  text: string
  start: number
  end: number
}

export interface ASRResult {
  text: string
  /** Audio length in seconds — we bill minutes off this. */
  duration: number
  segments: ASRSegment[]
}

/**
 * Transcribe an audio buffer. Fish's ASR is a BETA endpoint and accepts only
 * form-data or msgpack — a JSON body is rejected despite the OpenAPI schema
 * showing one. `ignore_timestamps` defaults to true on their side; we pass it
 * explicitly because per-segment timings are what build a call transcript.
 */
export async function speechToText(
  audio: Blob,
  opts: { language?: string; timestamps?: boolean } = {}
): Promise<ASRResult> {
  const fd = new FormData()
  fd.append('audio', audio, 'audio.wav')
  if (opts.language) fd.append('language', opts.language)
  fd.append('ignore_timestamps', String(!(opts.timestamps ?? true)))
  return requestFormData<ASRResult>('POST', '/v1/asr', fd)
}

// ─── Cost accounting ─────────────────────────────────────────────────────────

/**
 * Fish bills TTS per UTF-8 BYTE, not per character — $15 per 1M bytes.
 *
 * This distinction is not pedantic for a Romanian product: ă â î ș ț are all
 * two bytes each in UTF-8, so Romanian copy costs materially more per visible
 * character than the English-based estimates on Fish's pricing page imply.
 * Always meter with this function rather than `text.length`.
 */
export const USD_PER_MILLION_BYTES = 15

export function ttsCostUsd(text: string): number {
  const bytes = Buffer.byteLength(text, 'utf8')
  return (bytes / 1_000_000) * USD_PER_MILLION_BYTES
}

/** ASR is billed per audio hour ($0.36), unlike TTS which is per byte. */
export const USD_PER_ASR_HOUR = 0.36

export function asrCostUsd(durationSeconds: number): number {
  return (durationSeconds / 3600) * USD_PER_ASR_HOUR
}
