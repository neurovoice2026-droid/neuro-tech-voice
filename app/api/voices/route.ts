import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRoute, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { enforceRateLimit, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { MAX_CLONES_PER_ORG, VOICE_LANGUAGE_CODES } from '@/components/voice/voice-options'
import { cloneMatchesFilters, cloneToVoice, type VoiceFilters } from './_lib/filters'
import { listCatalogVoices, listOrgClones } from './_lib/catalog'
import { requireCartesia, toVoiceApiError } from './_lib/synthesis'

export const runtime = 'nodejs'

// GET /api/voices?q&gender&language&accent&native&owner&cursor&limit
// owner=all  → the public Cartesia library (+ the org's matching clones on the
//              first page, marked is_owner). Cached per browser for 5 minutes.
// owner=mine → only the org's clones, plus what cloning the plan allows.

// Typing in the search box is debounced, but different queries miss the
// shared cache; this keeps one account from paging the provider in a loop.
const CATALOG_POLICY: RateLimitPolicy = { name: 'voiceCatalog', limit: 120, windowSeconds: 60 }

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

const querySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  gender: z.preprocess(blankToUndefined, z.enum(['masculine', 'feminine', 'gender_neutral']).optional()),
  language: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => VOICE_LANGUAGE_CODES.includes(value), 'Unsupported language')
      .optional()
  ),
  accent: z.preprocess(
    blankToUndefined,
    z.string().trim().max(48).regex(/^[A-Za-z0-9_-]+$/, 'Invalid accent').optional()
  ),
  native: z.preprocess(blankToUndefined, z.enum(['0', '1']).default('1')),
  owner: z.preprocess(blankToUndefined, z.enum(['mine', 'all']).default('all')),
  cursor: z.preprocess(blankToUndefined, z.string().max(64).regex(/^[A-Za-z0-9-]+$/, 'Invalid cursor').optional()),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(48).default(24)),
})

export const GET = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  const query = parseSearchParams(req.nextUrl, querySchema)
  await enforceRateLimit(CATALOG_POLICY, ctx.user.id)

  const filters: VoiceFilters = {
    q: query.q ?? null,
    gender: query.gender ?? null,
    language: query.language ?? null,
    accent: query.accent ?? null,
    nativeOnly: query.native === '1',
  }

  if (query.owner === 'mine') {
    const clones = await listOrgClones(ctx)
    const entitled = entitlementsFor(ctx.org.plan).voiceCloning
    return NextResponse.json(
      {
        voices: clones.filter((clone) => cloneMatchesFilters(clone, filters)).map(cloneToVoice),
        next_cursor: null,
        cloning: {
          entitled,
          required_plan: requiredPlanFor('voiceCloning'),
          count: clones.length,
          max: MAX_CLONES_PER_ORG,
        },
      },
      // Clones change when the owner creates or deletes one: always revalidate.
      { headers: { 'Cache-Control': 'private, no-cache' } }
    )
  }

  requireCartesia()
  const [catalog, clones] = await Promise.all([
    listCatalogVoices(filters, query.cursor ?? null, query.limit).catch((error: unknown) => {
      throw toVoiceApiError(error, 'catalog')
    }),
    // The org's own voices lead the first page only, so paging never repeats them.
    query.cursor ? Promise.resolve([]) : listOrgClones(ctx),
  ])

  const ownVoices = clones.filter((clone) => cloneMatchesFilters(clone, filters)).map(cloneToVoice)
  return NextResponse.json(
    { voices: [...ownVoices, ...catalog.voices], next_cursor: catalog.nextCursor },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
})
