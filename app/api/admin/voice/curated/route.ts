// POST /api/admin/voice/curated — curated platform voices per agent language.
// { dry_run?: true (default), languages?: ['ro', …], per_language?: 5 }
//   → proposals from the public Voice Library (conversational, studio quality,
//     verified for the language, sorted by trending then clones) and the
//     voices curated today. Read-only.
// { dry_run: false, approve: [{ language, public_owner_id, voice_id, rank }], remove?: [{ language, voice_id }] }
//   → provisions the approved voices as platform-wide library voices
//     (re-validated against the library) and sets featured_languages /
//     featured_rank; removes curation where asked. Audited.
// Platform admins only (ADMIN_API_TOKEN or PLATFORM_ADMIN_USER_IDS).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { CURATED_LANGUAGES, applyCuratedVoices, proposeCuratedVoices } from '@/lib/voice-providers/curated-voices'
import { EL_OWNER_ID_RE, EL_VOICE_ID_RE, languageSchema } from '@/lib/voice-providers/voice-catalog'

export const maxDuration = 300

const Body = z
  .object({
    dry_run: z.boolean().optional().default(true),
    languages: z.array(languageSchema).min(1).max(CURATED_LANGUAGES.length).optional(),
    per_language: z.number().int().min(1).max(20).optional().default(5),
    approve: z
      .array(
        z
          .object({
            language: languageSchema,
            public_owner_id: z.string().regex(EL_OWNER_ID_RE),
            voice_id: z.string().regex(EL_VOICE_ID_RE),
            rank: z.number().int().min(0).max(1000),
          })
          .strict(),
      )
      .max(50)
      .optional()
      .default([]),
    remove: z
      .array(z.object({ language: languageSchema, voice_id: z.string().regex(EL_VOICE_ID_RE) }).strict())
      .max(50)
      .optional()
      .default([]),
  })
  .strict()

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.curated' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 32 * 1024)
    if (body.dry_run) {
      if (body.approve.length || body.remove.length) {
        throw new RequestError('invalid_request', 'approve/remove require dry_run=false.', 400)
      }
      const proposals = await proposeCuratedVoices({ languages: body.languages ?? CURATED_LANGUAGES, perLanguage: body.per_language, log })
      log.info('admin.voice.curated.proposed', { by: admin.kind, languages: proposals.length })
      return NextResponse.json({ dry_run: true, proposals }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!body.approve.length && !body.remove.length) {
      throw new RequestError('invalid_request', 'Nothing to apply: give approve and/or remove.', 400)
    }
    const result = await applyCuratedVoices({
      approve: body.approve,
      remove: body.remove,
      actor: { userId: admin.userId, kind: admin.kind === 'token' ? 'admin_token' : 'admin_user' },
      log,
    })
    log.info('admin.voice.curated.applied', {
      by: admin.kind,
      curated: result.approved.filter((a) => a.status === 'curated').length,
      removed: result.removed.filter((r) => r.status === 'removed').length,
    })
    return NextResponse.json({ dry_run: false, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.voice.curated_failed', requestId)
  }
}
