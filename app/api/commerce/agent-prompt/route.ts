// GET /api/commerce/agent-prompt — the baseline prompt and first message of
// the store agent (written in the language the agent calls in), built from
// the saved profile (and the agent's saved name). The editor's "Regenerate"
// may pass what is currently typed (?agent_name, ?tone, ?transfer_number,
// ?return_policy_url) so the result matches the form rather than the last
// saved values. Nothing is written.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { COMMERCE_TONES, readCommerceProfile } from '@/lib/commerce/profile'
import { buildCommerceAgentPrompt } from '@/lib/commerce/prompt'
import { E164_REGEX } from '@/lib/phone/e164'
import { stripPlatformVariables } from '@/lib/voice-providers/template-variables'

function isHttpsUrl(value: string): boolean {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol)
}

const QuerySchema = z.object({
  agent_name: z.string().trim().max(100).optional(),
  tone: z.enum(COMMERCE_TONES).optional(),
  transfer_number: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => v === undefined || v === '' || E164_REGEX.test(v), 'Use the international format, e.g. +40712345678'),
  return_policy_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => v === undefined || v === '' || isHttpsUrl(v), 'The address must start with https://'),
})

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'commerce.agent_prompt' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    const params = new URL(request.url).searchParams
    const parsed = QuerySchema.safeParse({
      agent_name: params.get('agent_name') ?? undefined,
      tone: params.get('tone') ?? undefined,
      transfer_number: params.get('transfer_number') ?? undefined,
      return_policy_url: params.get('return_policy_url') ?? undefined,
    })
    if (!parsed.success) {
      throw new RequestError(
        'invalid_request',
        'Some fields are invalid.',
        400,
        parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
      )
    }
    const query = parsed.data

    const [orgRes, agentRes] = await Promise.all([
      supabase.from('organizations').select('name, business_type, commerce_profile').eq('id', org.id).single(),
      supabase.from('agents').select('name').eq('org_id', org.id).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ])
    if (orgRes.error) throw new Error(`organizations read failed: ${orgRes.error.message}`)
    if (agentRes.error) throw new Error(`agents read failed: ${agentRes.error.message}`)
    if (orgRes.data.business_type !== 'ecommerce') {
      throw new RequestError('precondition_failed', 'This setup is only available to online stores.', 409, {
        reason: 'not_ecommerce',
      })
    }

    const profile = readCommerceProfile(orgRes.data.commerce_profile)
    // Overrides: a present-but-empty value clears the field ("" → no transfer), an absent one keeps the profile's.
    const transferNumber = query.transfer_number !== undefined ? query.transfer_number || null : profile.transfer_number
    const returnPolicyUrl = query.return_policy_url !== undefined ? query.return_policy_url || null : profile.return_policy_url
    const agentName = stripPlatformVariables(query.agent_name || (agentRes.data?.name as string | undefined) || '')

    const result = buildCommerceAgentPrompt({
      storeName: profile.display_name || (orgRes.data.name as string | null) || '',
      language: profile.language,
      tone: query.tone ?? profile.tone,
      transferNumber,
      returnPolicyUrl,
      agentName,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'commerce.agent_prompt_failed', requestId)
  }
}
