// POST /api/commerce/onboarding/store — store onboarding step 1: the store
// profile (display name, website, country, time zone, agent language,
// currency). Saves organizations.name / website / timezone and the
// commerce_profile (admin client: the profile column is guarded by a DB
// trigger against tenant writes) and moves the resume position to step 2.
// The org's agent row is created here too (no provider calls; the launch
// step syncs it), so the later agent and voice steps have a row to update.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { AgentLanguageSchema, WebsiteSchema, defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import { CommerceProfileSchema, readCommerceProfile } from '@/lib/commerce/profile'
import { PLATFORM_VARIABLE_MESSAGE, hasNoPlatformVariables } from '@/lib/voice-providers/template-variables'

/** A zone the runtime can format in; typos never reach the automations' call windows. */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const StoreSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, 'The store name needs at least 2 characters')
    .max(100, 'The store name can have at most 100 characters')
    .refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE),
  website: WebsiteSchema.optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'The country must be a two-letter ISO code'),
  timezone: z.string().trim().min(1).max(64).refine(isTimeZone, 'Unknown time zone'),
  language: AgentLanguageSchema.default('ro'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'The currency must be a three-letter ISO code'),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'commerce.onboarding.store' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, StoreSchema, 8 * 1024)

    const { data: row, error: readErr } = await supabase
      .from('organizations')
      .select('business_type, commerce_profile')
      .eq('id', org.id)
      .single()
    if (readErr) throw new Error(`organizations read failed: ${readErr.message}`)
    if (row.business_type !== 'ecommerce') {
      throw new RequestError('precondition_failed', 'This setup is only available to online stores.', 409, {
        reason: 'not_ecommerce',
      })
    }

    // The stored profile keeps what later steps set (tone, transfer number, return policy).
    const profile = CommerceProfileSchema.parse({
      ...readCommerceProfile(row.commerce_profile),
      display_name: body.display_name,
      website: body.website ?? '',
      country: body.country,
      timezone: body.timezone,
      language: body.language,
      currency: body.currency,
    })

    const admin = createAdminClient()
    const { error: writeErr } = await admin
      .from('organizations')
      .update({
        name: profile.display_name,
        website: profile.website || null,
        timezone: profile.timezone,
        commerce_profile: profile,
        onboarding_step: 2,
      })
      .eq('id', org.id)
    if (writeErr) throw new Error(`organizations update failed: ${writeErr.message}`)

    await ensureAgent(org.id, defaultAgentName(profile.display_name))
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'commerce.onboarding.store_failed', requestId)
  }
}
