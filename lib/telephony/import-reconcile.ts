import 'server-only'
// Native import report (admin): the ElevenLabs imports labelled for THIS
// environment (`ntv:<env>:`, lib/telephony/import-label.ts) compared with our
// phone_numbers rows.
//
//   matched   an import whose number is one of our native_elevenlabs numbers
//             (a stored id or label org that differs is reported as an issue);
//   orphan    an import whose number has no native row here (a release whose
//             provider cleanup failed, a mode change interrupted mid-way).
//
// Dry run by default. Deleting needs apply AND delete_orphans, and is limited
// to orphans that are unassigned or assigned to one of OUR agents: an import
// assigned to an agent this database does not know belongs to another
// deployment sharing the workspace (same environment name, different
// database) and is only reported. Numbers are masked in the report and logs.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import * as el from '@/lib/elevenlabs/client'
import { collectImportedNumbers, type ELImportedNumber } from '@/lib/elevenlabs/api/phone-numbers'
import { isProviderError, toProviderError } from '@/lib/voice-providers/errors'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { deploymentEnv, importLabelPrefix, parseImportLabel } from './import-label'

export interface ImportIssue {
  phone_number_id: string
  number: string
  issue: 'id_mismatch' | 'label_org_mismatch' | 'not_native'
}

export interface ImportOrphan {
  phone_number_id: string
  number: string
  /** none = unassigned; ours = one of this database's agents; foreign = an agent we do not know (never deleted). */
  assigned: 'none' | 'ours' | 'foreign'
  deleted?: boolean
  error?: string
}

export interface ImportReport {
  configured: boolean
  env: string
  listed: number
  truncated: boolean
  matched: number
  issues: ImportIssue[]
  orphans: ImportOrphan[]
  deleted: number
}

async function rowsByNumber(db: SupabaseClient, numbers: string[]): Promise<Map<string, { id: string; org_id: string; routing_mode: string; elevenlabs_phone_number_id: string | null }>> {
  const out = new Map<string, { id: string; org_id: string; routing_mode: string; elevenlabs_phone_number_id: string | null }>()
  for (let i = 0; i < numbers.length; i += 100) {
    const { data, error } = await db
      .from('phone_numbers')
      .select('id, org_id, number, routing_mode, elevenlabs_phone_number_id')
      .in('number', numbers.slice(i, i + 100))
    if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
    for (const r of data ?? []) {
      out.set(r.number as string, {
        id: r.id as string,
        org_id: r.org_id as string,
        routing_mode: r.routing_mode as string,
        elevenlabs_phone_number_id: (r.elevenlabs_phone_number_id as string | null) ?? null,
      })
    }
  }
  return out
}

async function ourAgentIds(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from('agent_provider_resources')
      .select('external_id')
      .eq('provider', 'elevenlabs')
      .in('external_id', ids.slice(i, i + 100))
    if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
    for (const r of data ?? []) if (r.external_id) out.add(r.external_id as string)
  }
  return out
}

export async function reconcileNativeImports(
  opts: { apply?: boolean; deleteOrphans?: boolean; limit?: number; log?: Logger } = {},
): Promise<ImportReport> {
  const log = (opts.log ?? createLogger()).child({ component: 'native_imports' })
  const env = deploymentEnv()
  const report: ImportReport = { configured: el.isConfigured(), env, listed: 0, truncated: false, matched: 0, issues: [], orphans: [], deleted: 0 }
  if (!report.configured) return report
  const db = createAdminClient()

  const listing = await collectImportedNumbers({ label: importLabelPrefix() })
  // The label filter is a substring match: keep only labels that parse as ours.
  const ours: Array<ELImportedNumber & { e164: string; labelOrg: string }> = []
  for (const n of listing.numbers) {
    const parsed = parseImportLabel(n.label)
    const e164 = normalizeE164(n.phone_number ?? '')
    if (parsed && parsed.env === env && e164) ours.push({ ...n, e164, labelOrg: parsed.orgId })
  }
  report.listed = ours.length
  report.truncated = listing.truncated

  const rows = await rowsByNumber(db, [...new Set(ours.map((n) => n.e164))])
  const assignedIds = [...new Set(ours.map((n) => n.assigned_agent?.agent_id).filter((v): v is string => !!v))]
  const agents = await ourAgentIds(db, assignedIds)

  const orphans: Array<ImportOrphan & { raw: ELImportedNumber }> = []
  for (const n of ours) {
    const row = rows.get(n.e164)
    const masked = maskPhone(n.e164)
    if (row && row.routing_mode === 'native_elevenlabs') {
      report.matched++
      if (row.elevenlabs_phone_number_id !== n.phone_number_id) report.issues.push({ phone_number_id: n.phone_number_id, number: masked, issue: 'id_mismatch' })
      if (row.org_id.toLowerCase() !== n.labelOrg) report.issues.push({ phone_number_id: n.phone_number_id, number: masked, issue: 'label_org_mismatch' })
      continue
    }
    const agent = n.assigned_agent?.agent_id ?? null
    const assigned: ImportOrphan['assigned'] = !agent ? 'none' : agents.has(agent) ? 'ours' : 'foreign'
    if (row) report.issues.push({ phone_number_id: n.phone_number_id, number: masked, issue: 'not_native' })
    orphans.push({ phone_number_id: n.phone_number_id, number: masked, assigned, raw: n })
  }

  // A truncated listing is fine for orphans (each one was seen), but deletions stay bounded.
  let budget = Math.max(0, Math.min(200, opts.limit ?? 50))
  for (const o of orphans) {
    const { raw, ...entry } = o
    void raw
    if (opts.apply && opts.deleteOrphans && o.assigned !== 'foreign' && budget > 0) {
      budget--
      try {
        await el.phoneNumbers.delete(o.phone_number_id)
        entry.deleted = true
        report.deleted++
        log.warn('native_imports.orphan_deleted', { phoneNumberId: o.phone_number_id, number: o.number })
      } catch (err) {
        if (isProviderError(err) && err.code === 'not_found') {
          entry.deleted = true
        } else {
          entry.error = toProviderError(err, 'elevenlabs', 'phone_numbers.delete').code
          log.error('native_imports.orphan_delete_failed', err, { phoneNumberId: o.phone_number_id })
        }
      }
    }
    report.orphans.push(entry)
  }
  log.info('native_imports.report', { listed: report.listed, matched: report.matched, orphans: report.orphans.length, issues: report.issues.length, deleted: report.deleted, truncated: report.truncated })
  return report
}
