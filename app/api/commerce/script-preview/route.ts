// GET /api/commerce/script-preview?type&connection_id — the automation's script with sample values resolved.
import { RequestError } from '@/lib/api/http'
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { readAutomationScript } from '@/lib/commerce/automations/config'
import { AUTOMATION_COLUMNS, type AutomationRow } from '@/lib/commerce/automations/scheduler'
import { SAMPLE_SCRIPT_VALUES, renderScript } from '@/lib/commerce/prompt'
import { primaryConnection } from '@/lib/commerce/store'
import { AUTOMATION_TYPES, type AutomationType } from '@/lib/commerce/types'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'script_preview', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const url = new URL(request.url)
    const type = url.searchParams.get('type') ?? ''
    if (!(AUTOMATION_TYPES as readonly string[]).includes(type)) throw new RequestError('invalid_request', 'Tip de automatizare necunoscut.', 400)
    const connId = url.searchParams.get('connection_id')
    const connection = connId ? await ownedConnection(ctx.db, ctx.org.id, connId) : await primaryConnection(ctx.db, ctx.org.id)
    const { data: agent } = await ctx.db.from('agents').select('name').eq('org_id', ctx.org.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    let row: AutomationRow | null = null
    if (connection) {
      const { data, error } = await ctx.db.from('commerce_automations').select(AUTOMATION_COLUMNS).eq('connection_id', connection.id).eq('type', type).maybeSingle()
      if (error) throw new Error(`commerce_automations read failed: ${error.message}`)
      row = (data as AutomationRow | null) ?? null
    }
    const brand = ctx.profile.display_name || ctx.org.name
    const script = readAutomationScript(type as AutomationType, row?.script, brand)
    const text = renderScript(script.template, { ...SAMPLE_SCRIPT_VALUES, store_name: script.brand_name || brand || SAMPLE_SCRIPT_VALUES.store_name, agent_name: (agent?.name as string | undefined) || SAMPLE_SCRIPT_VALUES.agent_name, call_reason: type })
    return noStore({ text })
  })
}
