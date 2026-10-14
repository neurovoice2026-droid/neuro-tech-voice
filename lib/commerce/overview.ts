import 'server-only'
// The store overview: connection, automations, queue, recent calls and the
// problems that stop automations from working (each with where to fix it).

import type { SupabaseClient } from '@supabase/supabase-js'
import { callAllowance } from '@/lib/telephony/quota'
import { commerceCryptoConfigured } from './crypto'
import { enableGate, listAutomationDtos } from './automations/service'
import { type ConnectionRow, RUN_COLUMNS_WITH_REFS, type RunRow, connectionDto, countRunsByStatus, primaryConnection, readWebhookConfig, runDto } from './store'
import type { CommerceOverviewDto, CommerceProblemCode } from './types'

export async function buildOverview(db: SupabaseClient, org: { id: string; plan: string | null }, brandName: string | null): Promise<CommerceOverviewDto> {
  const connection = await primaryConnection(db, org.id)
  const [automations, queue, recent, gate, usage] = await Promise.all([
    connection ? listAutomationDtos(db, connection, brandName) : Promise.resolve([]),
    countRunsByStatus(db, { orgId: org.id }),
    db.from('commerce_automation_runs').select(RUN_COLUMNS_WITH_REFS).eq('org_id', org.id).order('created_at', { ascending: false }).limit(10),
    enableGate(db, org.id),
    db.from('organizations').select('plan, minutes_used, minutes_limit').eq('id', org.id).maybeSingle(),
  ])
  if (recent.error) throw new Error(`commerce_automation_runs read failed: ${recent.error.message}`)
  const problems: CommerceOverviewDto['problems'] = []
  const push = (code: CommerceProblemCode, message: string, href: string | null) => problems.push({ code, message, href })
  if (!commerceCryptoConfigured()) push('encryption_not_configured', 'Criptarea datelor de acces nu este configurată pe platformă: conectarea magazinelor este oprită.', null)
  if (!connection) push('no_connection', 'Niciun magazin conectat încă.', '/magazin/conexiuni')
  else {
    if (connection.status === 'error') push('credentials_expired', connection.error_message ?? 'Accesul la magazin a expirat: reconectează magazinul.', '/magazin/conexiuni')
    else if (connection.status === 'degraded') push('sync_error', connection.error_message ?? 'Ultima sincronizare a eșuat; se reîncearcă automat.', '/magazin/conexiuni')
    else if (connection.status === 'disconnected') push('no_connection', 'Magazinul este deconectat.', '/magazin/conexiuni')
    const wh = readWebhookConfig(connection.webhook_config)
    if (wh.last_error && (!wh.last_delivery_at || Date.parse(wh.last_error_at ?? '') > Date.parse(wh.last_delivery_at))) push('webhook_failure', wh.last_error, '/magazin/conexiuni')
  }
  const anyEnabled = automations.some((a) => a.enabled)
  if (!gate.agentActive) push('agent_inactive', 'Agentul este oprit: apelurile automate nu pornesc.', '/agent')
  if (!gate.hasOutboundNumber) push('no_phone_number', 'Nu ai un număr activ care poate suna: apelurile automate nu pornesc.', '/phone')
  if (connection && !automations.some((a) => a.consent_confirmed_at) ) push('no_consent', 'Nicio automatizare nu are consimțământul confirmat.', '/magazin/automatizari')
  const allowance = callAllowance(usage.data ? { plan: (usage.data.plan as string | null) ?? org.plan, minutes_used: usage.data.minutes_used as number | null, minutes_limit: usage.data.minutes_limit as number | null } : null)
  if (!allowance.allowed) push('minutes_exhausted', 'Minutele incluse în plan s-au epuizat: apelurile automate nu pornesc.', '/billing')
  void anyEnabled
  return {
    connection: connection ? await connectionDto(db, connection) : null,
    automations,
    queue: { eligible: queue.eligible, scheduled: queue.scheduled, calling: queue.calling, completed: queue.completed, suppressed: queue.suppressed, failed: queue.failed },
    recent_runs: ((recent.data ?? []) as RunRow[]).map(runDto),
    problems,
  }
}

export type { ConnectionRow }
