// POST /api/voices/clone — ElevenLabs Instant Voice Clone for this org only.
// multipart/form-data:
//   name, speaker_name, consent='true', rights_attestation='true',
//   files (1–3 audio samples; `files[]` also accepted), language? (agent language by default)
// → 201 { voice: VoiceOption } (+ requires_verification: true when the provider
//   holds the voice for verification; it is not selectable until then).
//
// Vercel rejects request bodies above 4.5 MB, so the samples are limited to
// 4 MB in total. Each file is checked by MIME type AND magic bytes. Audio is
// forwarded to ElevenLabs and never stored here; consent is recorded on the
// registry row and in the audit log.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin } from '@/lib/api/http'
import * as el from '@/lib/elevenlabs/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  CLONE_LIMITS,
  CLONE_MIME_TYPES,
  cleanText,
  createInstantClone,
  hashClientIp,
  languageSchema,
  orgAgentLanguage,
  sniffAudio,
  voiceErrorResponse,
  type CloneSample,
} from '@/lib/voice-providers/voice-catalog'

export const maxDuration = 60

const FieldsSchema = z.object({
  name: z.string().trim().min(1, 'Give the voice a name.').max(100),
  speaker_name: z.string().trim().min(1, "Enter the speaker's name.").max(100),
  consent: z.string().optional(),
  rights_attestation: z.string().optional(),
  language: z.preprocess((v) => (v === '' ? undefined : v), languageSchema.optional()),
})

function textField(form: FormData, key: string): string | undefined {
  const v = form.get(key)
  return typeof v === 'string' ? v : undefined
}

async function readSamples(form: FormData): Promise<CloneSample[]> {
  const entries = [...form.getAll('files'), ...form.getAll('files[]')]
  if (entries.some((e) => typeof e === 'string')) {
    throw new RequestError('invalid_request', 'Audio samples must be uploaded as files.', 400)
  }
  const files = entries as File[]
  if (files.length < CLONE_LIMITS.minFiles || files.length > CLONE_LIMITS.maxFiles) {
    throw new RequestError('invalid_request', `Upload between ${CLONE_LIMITS.minFiles} and ${CLONE_LIMITS.maxFiles} audio samples.`, 400)
  }
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > CLONE_LIMITS.maxTotalBytes) {
    throw new RequestError('payload_too_large', 'The samples are too large: keep them under 4 MB in total.', 413)
  }

  const samples: CloneSample[] = []
  for (const [i, file] of files.entries()) {
    const label = `Sample ${i + 1}`
    if (file.size < CLONE_LIMITS.minFileBytes) {
      throw new RequestError('invalid_request', `${label} is empty or too short.`, 400)
    }
    const mime = (file.type ?? '').split(';')[0].trim().toLowerCase()
    const expected = CLONE_MIME_TYPES[mime]
    if (!expected) {
      throw new RequestError('unsupported_media_type', `${label}: use MP3, WAV, OGG, WebM or M4A audio.`, 415)
    }
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const detected = sniffAudio(head)
    if (detected !== expected) {
      throw new RequestError('unsupported_media_type', `${label} is not a valid ${expected.toUpperCase()} audio file.`, 415)
    }
    samples.push({ file, kind: detected, mime })
  }
  return samples
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.clone' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.startsWith('multipart/form-data')) {
      throw new RequestError('unsupported_media_type', 'Expected a multipart/form-data upload.', 415)
    }
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > CLONE_LIMITS.maxRequestBytes) {
      throw new RequestError('payload_too_large', 'The samples are too large: keep them under 4 MB in total.', 413)
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch (err) {
      log.warn('voices.clone.unreadable_form', { error: err instanceof Error ? err.name : typeof err })
      throw new RequestError('invalid_request', 'The upload could not be read.', 400)
    }

    const parsed = FieldsSchema.safeParse({
      name: textField(form, 'name'),
      speaker_name: textField(form, 'speaker_name'),
      consent: textField(form, 'consent'),
      rights_attestation: textField(form, 'rights_attestation'),
      language: textField(form, 'language'),
    })
    if (!parsed.success) {
      throw new RequestError(
        'invalid_request',
        'Some fields are invalid.',
        400,
        parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
      )
    }
    const fields = parsed.data
    if (fields.consent !== 'true' || fields.rights_attestation !== 'true') {
      throw new RequestError(
        'invalid_request',
        'Confirm that the speaker consented to this clone and that you have the rights to use their voice.',
        400,
      )
    }
    const speakerName = cleanText(fields.speaker_name, 100)
    const name = cleanText(fields.name, 100)
    if (!speakerName || !name) throw new RequestError('invalid_request', 'Enter the voice name and the speaker name.', 400)

    const samples = await readSamples(form)
    if (!el.isConfigured()) {
      throw new RequestError('not_configured', 'Voice cloning is not available on the platform right now.', 503)
    }
    // Counted only for well-formed requests: a rejected upload does not burn the daily quota.
    await enforceRateLimit([RATE_LIMITS.voiceClone], org.id)

    const language = fields.language ?? (await orgAgentLanguage(supabase, org.id))
    const result = await createInstantClone({
      orgId: org.id,
      userId: user.id,
      name,
      speakerName,
      language,
      samples,
      ipHash: hashClientIp(request.headers.get('x-forwarded-for')),
      log,
    })
    return NextResponse.json(
      { voice: result.voice, ...(result.requiresVerification ? { requires_verification: true } : {}) },
      { status: 201 },
    )
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.clone.failed', requestId)
  }
}
