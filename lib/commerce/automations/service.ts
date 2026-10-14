import 'server-only'
// Automation configuration as the routes see it: the three templates per
// connection (configured or not), the enable gate (consent, capability,
// agent, number, encryption, connection) and the DTO with run counts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { RequestError } from '@/lib/api/http'
import type { Logger } from '@/lib/observability/logger'
import { commerceCryptoConfigured } from '../crypto'
import { type ConnectionRow, countRunsByStatus, readCapabilities, writeAudit } from '../store'
import { AUTOMATION_TYPES, type AutomationDto, type AutomationType } from '../types'
import { AutomationConfigSchema, AutomationScriptSchema, CONSENT_VERSION, automationAvailability, readAutomationConfig, readAutomationScript } from './config'
import { AUTOMATION_COLUMNS, type AutomationRow, listAutomations } from './scheduler'

export const AutomationPatchSchema = z.object({
  connection_id: z.string().uuid(),
  enabled: z.boolean().optional(),
  config: AutomationConfigSchema.partial().optional(),
  script: AutomationScriptSchema.partial().optional(),
  consent_confirmed: z.literal(true).optional(),
})
export type AutomationPatch = z.infer<typeof AutomationPatchSchema>

export async function automationDto(db: SupabaseClient, connection: ConnectionRow, type: AutomationType, row: AutomationRow | null, brandName: string | null): Promise<AutomationDto> {
  const caps = readCapabilities(connection.capabilities)
  const availability = automationAvailability(type, caps)
  const stats = row ? await countRunsByStatus(db, { orgId: connection.org_id, automationId: row.id }) : null
  return {
    id: row?.id ?? null,
    connection_id: connection.id,
    type,
    enabled: !!row?.enabled,
    available: availability.available,
    unavailable_reason: availability.reason,
    config: readAutomationConfig(type, row?.config),
    script: readAutomationScript(type, row?.script, brandName),
    consent_confirmed_at: row?.consent_confirmed_at ?? null,
    consent_version: row?.consent_version ?? null,
    stats: {
      eligible: stats?.eligible ?? 0,
      scheduled: stats?.scheduled ?? 0,
      calling: stats?.calling ?? 0,
      completed: stats?.completed ?? 0,
      suppressed: stats?.suppressed ?? 0,
      failed: stats?.failed ?? 0,
    },
    created_at: row?.created_at ?? connection.created_at,
    updated_at: row?.updated_at ?? connection.created_at,
  }
}

export async function listAutomationDtos(db: SupabaseClient, connection: ConnectionRow, brandName: string | null): Promise<AutomationDto[]> {
  const rows = await listAutomations(db, connection.org_id, connection.id)
  return Promise.all(AUTOMATION_TYPES.map((type) => automationDto(db, connection, type, rows.find((r) => r.type === type) ?? null, brandName)))
}

export interface EnableGate {
  agentActive: boolean
  hasOutboundNumber: boolean
}

/** What an organization needs before any automation may dial (shared with the overview's problem list). */
export async function enableGate(db: SupabaseClient, orgId: string): Promise<EnableGate> {
  const [{ data: agent, error: agentErr }, { count, error: numErr }] = await Promise.all([
    db.from('agents').select('id, is_active').eq('org_id', orgId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    db.from('phone_numbers').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true).eq('supports_outbound', true),
  ])
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
  if (numErr) throw new Error(`phone_numbers read failed: ${numErr.message}`)
  return { agentActive: agent?.is_active === true, hasOutboundNumber: (count ?? 0) > 0 }
}

/**
 * Creates or updates the automation of `type` on the connection. Enabling
 * requires the consent confirmation (this request or an earlier one), an
 * available capability, an active agent with an outbound number, the
 * encryption key and a usable connection; otherwise 409 with the reason.
 */
export async function upsertAutomation(
  db: SupabaseClient,
  input: { orgId: string; userId: string | null; connection: ConnectionRow; type: AutomationType; patch: AutomationPatch; agentId: string | null; brandName: string | null },
  log: Logger,
): Promise<AutomationDto> {
  const { connection, type, patch } = input
  const { data: existing, error } = await db.from('commerce_automations').select(AUTOMATION_COLUMNS).eq('connection_id', connection.id).eq('type', type).maybeSingle()
  if (error) throw new Error(`commerce_automations read failed: ${error.message}`)
  const current = (existing as AutomationRow | null) ?? null
  const config = readAutomationConfig(type, { ...readAutomationConfig(type, current?.config), ...(patch.config ?? {}) })
  const script = readAutomationScript(type, { ...readAutomationScript(type, current?.script, input.brandName), ...(patch.script ?? {}) }, input.brandName)
  const consentAt = patch.consent_confirmed ? new Date().toISOString() : (current?.consent_confirmed_at ?? null)
  const wantEnabled = patch.enabled ?? current?.enabled ?? false

  if (wantEnabled && !(current?.enabled ?? false)) {
    const availability = automationAvailability(type, readCapabilities(connection.capabilities))
    const fail = (reason: string, message: string) => new RequestError('precondition_failed', message, 409, { reason })
    if (!availability.available) throw fail('unavailable', availability.reason ?? 'This automation is not available on this platform.')
    if (!consentAt) throw fail('no_consent', 'Confirm customer consent for calls first.')
    if (connection.status !== 'active' && connection.status !== 'degraded') throw fail('connection_inactive', 'Connect the store before enabling automations.')
    if (!commerceCryptoConfigured()) throw fail('encryption_not_configured', 'Credential encryption is not configured on the platform.')
    const gate = await enableGate(db, input.orgId)
    if (!gate.agentActive) throw fail('agent_inactive', 'The agent is paused: turn it on before enabling automations.')
    if (!gate.hasOutboundNumber) throw fail('no_phone_number', 'You need an active phone number that can place calls.')
  }

  const row = {
    org_id: input.orgId,
    connection_id: connection.id,
    agent_id: input.agentId,
    type,
    enabled: wantEnabled,
    // Only orders created after this instant are ever called.
    enabled_at: wantEnabled ? (current?.enabled ? current.enabled_at : new Date().toISOString()) : (current?.enabled_at ?? null),
    config,
    script,
    consent_confirmed_at: consentAt,
    consent_confirmed_by: patch.consent_confirmed ? input.userId : (current?.consent_confirmed_by ?? null),
    consent_version: consentAt ? (patch.consent_confirmed ? CONSENT_VERSION : (current?.consent_version ?? CONSENT_VERSION)) : null,
  }
  const { data, error: upErr } = await db.from('commerce_automations').upsert(row, { onConflict: 'connection_id,type' }).select(AUTOMATION_COLUMNS).single()
  if (upErr) throw new Error(`commerce_automations upsert failed: ${upErr.message}`)
  const saved = data as AutomationRow
  if (wantEnabled !== (current?.enabled ?? false)) {
    await writeAudit(db, { orgId: input.orgId, actor: 'user', actorUserId: input.userId, action: wantEnabled ? 'automation.enabled' : 'automation.disabled', connectionId: connection.id, automationId: saved.id, metadata: { type } }, log)
    if (!wantEnabled) {
      // Pausing cancels what is queued; a running call finishes on its own. The automation is already
      // off (dispatch cancels its runs on claim), so a failure here is reported, not retried.
      const { error: cancelErr } = await db.from('commerce_automation_runs').update({ status: 'cancelled', eligibility_reason: 'Automation turned off', completed_at: new Date().toISOString() }).eq('automation_id', saved.id).in('status', ['eligible', 'scheduled', 'retry_waiting'])
      if (cancelErr) log.error('commerce.automation.cancel_runs_failed', cancelErr, { automationId: saved.id })
    }
  } else if (patch.config || patch.script || patch.consent_confirmed) {
    await writeAudit(db, { orgId: input.orgId, actor: 'user', actorUserId: input.userId, action: 'automation.updated', connectionId: connection.id, automationId: saved.id, metadata: { type, consent: !!patch.consent_confirmed } }, log)
  }
  return automationDto(db, connection, type, saved, input.brandName)
}
