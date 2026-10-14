// GET /api/commerce/onboarding/state — everything the store onboarding needs
// to resume: business type and step, the profile, the connection, the
// automations, the agent (no secrets), whether a number exists, and the
// launch checklist. Answers before the business type is chosen too.
import { commerceRoute, noStore, requireCommerceOrg } from '@/lib/commerce/api'
import { listAutomationDtos, enableGate } from '@/lib/commerce/automations/service'
import { commerceStepOf } from '@/lib/commerce/business-type'
import { connectionDto, primaryConnection } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'onboarding.state', async (log) => {
    const ctx = await requireCommerceOrg(log, { allowAnyType: true })
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const [{ data: org, error: orgErr }, connection, { data: agentRow, error: agentErr }, gate] = await Promise.all([
      ctx.db.from('organizations').select('onboarding_step, name').eq('id', ctx.org.id).maybeSingle(),
      ctx.businessType === 'ecommerce' ? primaryConnection(ctx.db, ctx.org.id) : Promise.resolve(null),
      ctx.db.from('agents').select('id, name, language, system_prompt, first_message, voice_id, voice_name, is_active').eq('org_id', ctx.org.id).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      enableGate(ctx.db, ctx.org.id),
    ])
    if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
    if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
    const brand = ctx.profile.display_name || ctx.org.name
    const automations = connection ? await listAutomationDtos(ctx.db, connection, brand) : []
    const dto = connection ? await connectionDto(ctx.db, connection) : null
    const syncReady = !!dto && !!dto.last_successful_sync_at
    const agent = agentRow
      ? {
          id: String(agentRow.id),
          name: String(agentRow.name ?? ''),
          language: String(agentRow.language ?? 'ro'),
          system_prompt: (agentRow.system_prompt as string | null) ?? null,
          first_message: (agentRow.first_message as string | null) ?? null,
          voice_id: (agentRow.voice_id as string | null) ?? null,
          voice_name: (agentRow.voice_name as string | null) ?? null,
          is_active: agentRow.is_active === true,
        }
      : null
    const checklist = [
      { key: 'connection', label: 'Magazin conectat', ok: !!dto && (dto.status === 'active' || dto.status === 'degraded'), href: null },
      { key: 'sync', label: 'Prima sincronizare finalizată', ok: syncReady, href: null },
      { key: 'agent', label: 'Agent configurat (nume, voce)', ok: !!agent && !!agent.voice_id, href: null },
      { key: 'phone', label: 'Număr de telefon activ', ok: gate.hasOutboundNumber, href: '/phone' },
      { key: 'consent', label: 'Consimțământ confirmat pentru apeluri', ok: automations.some((a) => !!a.consent_confirmed_at), href: null },
      { key: 'automation', label: 'Cel puțin o automatizare pornită (opțional)', ok: automations.some((a) => a.enabled), href: null },
    ]
    return noStore({
      business_type: ctx.businessType,
      onboarding_step: commerceStepOf(org?.onboarding_step),
      profile: { ...ctx.profile, display_name: ctx.profile.display_name || ((org?.name as string | null) ?? '') },
      connection: dto,
      automations,
      agent,
      has_phone_number: gate.hasOutboundNumber,
      checklist,
    })
  })
}
