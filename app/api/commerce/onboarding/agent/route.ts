// POST /api/commerce/onboarding/agent — store onboarding step 5 (the agent
// form): name, language, tone, transfer number, return policy URL, system
// prompt and first message. A blank prompt or first message gets the Romanian
// baseline (lib/commerce/prompt.ts) built from the saved profile. Saves the
// agent locally (the launch step pushes it to the providers), the tone /
// transfer / return-policy fields into commerce_profile (admin client: the
// column is guarded against tenant writes) and keeps the resume position on
// step 5: the voice is chosen next, still inside "Agentul tău", and the UI
// moves to step 6 only once it is saved.

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
import {
  AgentLanguageSchema,
  AgentNameSchema,
  FIRST_MESSAGE_MAX,
  SYSTEM_PROMPT_MAX,
  ensureAgent,
  mergeMetadata,
} from '@/lib/agents/ensure-agent'
import { COMMERCE_TONES, readCommerceProfile } from '@/lib/commerce/profile'
import { buildCommerceAgentPrompt } from '@/lib/commerce/prompt'
import { E164_REGEX } from '@/lib/phone/e164'
import { PLATFORM_VARIABLE_MESSAGE, hasNoPlatformVariables } from '@/lib/voice-providers/template-variables'

function isHttpsUrl(value: string): boolean {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol)
}

const AgentSchema = z.object({
  name: AgentNameSchema,
  language: AgentLanguageSchema,
  tone: z.enum(COMMERCE_TONES),
  transfer_number: z
    .string()
    .trim()
    .max(20)
    .optional()
    .default('')
    .refine((v) => v === '' || E164_REGEX.test(v), 'Număr în format internațional, ex. +40712345678'),
  return_policy_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default('')
    .refine((v) => v === '' || isHttpsUrl(v), 'Adresa trebuie să înceapă cu https://'),
  system_prompt: z.string().max(SYSTEM_PROMPT_MAX).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE).optional(),
  first_message: z.string().trim().max(FIRST_MESSAGE_MAX).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE).optional(),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'commerce.onboarding.agent' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, AgentSchema, 64 * 1024)

    const { data: row, error: readErr } = await supabase
      .from('organizations')
      .select('name, business_type, commerce_profile')
      .eq('id', org.id)
      .single()
    if (readErr) throw new Error(`organizations read failed: ${readErr.message}`)
    if (row.business_type !== 'ecommerce') {
      throw new RequestError('precondition_failed', 'Această configurare este disponibilă doar pentru magazine online.', 409, {
        reason: 'not_ecommerce',
      })
    }

    // Lenient merge: the three fields set here are validated by the body schema; a profile whose
    // store step was not (fully) saved keeps its defaults instead of failing the whole request.
    const profile = readCommerceProfile({
      ...readCommerceProfile(row.commerce_profile),
      tone: body.tone,
      transfer_number: body.transfer_number || null,
      return_policy_url: body.return_policy_url || null,
    })

    const generated = buildCommerceAgentPrompt({
      storeName: profile.display_name || (row.name as string | null) || '',
      language: body.language,
      tone: profile.tone,
      transferNumber: profile.transfer_number,
      returnPolicyUrl: profile.return_policy_url,
      agentName: body.name,
    })
    const systemPrompt = body.system_prompt?.trim() ? body.system_prompt : generated.system_prompt
    const firstMessage = body.first_message?.trim() ? body.first_message : generated.first_message

    const agent = await ensureAgent(org.id, body.name)
    log = log.child({ agentId: agent.id })
    const { error: agentErr } = await supabase
      .from('agents')
      .update({
        name: body.name,
        language: body.language,
        system_prompt: systemPrompt,
        first_message: firstMessage,
        // The tone doubles as the UI personality slug (both values are valid personalities).
        metadata: mergeMetadata(agent.metadata, { personality: body.tone }),
      })
      .eq('id', agent.id)
      .eq('org_id', org.id)
    if (agentErr) throw new Error(`agents update failed: ${agentErr.message}`)

    const admin = createAdminClient()
    const { error: orgErr } = await admin
      .from('organizations')
      .update({ commerce_profile: profile, onboarding_step: 5 })
      .eq('id', org.id)
    if (orgErr) throw new Error(`organizations update failed: ${orgErr.message}`)

    return NextResponse.json({ agent_id: agent.id, system_prompt: systemPrompt, first_message: firstMessage })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'commerce.onboarding.agent_failed', requestId)
  }
}
