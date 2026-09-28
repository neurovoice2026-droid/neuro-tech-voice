import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRoute, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { VOICE_LANGUAGE_CODES } from '@/components/voice/voice-options'
import { listAccents } from '../_lib/catalog'
import { requireCartesia, toVoiceApiError } from '../_lib/synthesis'

export const runtime = 'nodejs'

// GET /api/voices/accents?language=ro → accent ids and names for filter chips
// and the clone dialog. The list changes rarely: cached a day server-side.

const querySchema = z.object({
  language: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => VOICE_LANGUAGE_CODES.includes(value), 'Unsupported language')
      .optional()
  ),
})

export const GET = handleRoute(async (req) => {
  await requireOrgContext()
  const { language } = parseSearchParams(req.nextUrl, querySchema)
  requireCartesia()
  const accents = await listAccents(language ?? null).catch((error: unknown) => {
    throw toVoiceApiError(error, 'catalog')
  })
  return NextResponse.json(
    { accents: accents.map(({ id, name, locale, language: lang }) => ({ id, name, locale, language: lang })) },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  )
})
