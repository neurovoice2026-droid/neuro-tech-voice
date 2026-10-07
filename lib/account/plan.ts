import 'server-only'
// Dry run of an account deletion (admin offboarding): what each step would
// delete, and where, read from the organization's own rows only. No provider
// is called: conversations that only the provider knows about (listed by the
// org's agent at run time) are not counted here. Counts and booleans only:
// no names, numbers, emails or provider ids.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { RequestError } from '@/lib/api/http'
import { DELETION_ORDER, PREPARE_STEPS, type JobStepName } from './deletion-plan'
import { latestJobFor, type DeletionJobRow } from './job'
import { countOf } from './steps/util'

export interface PlannedStep {
  step: JobStepName
  where: string
  what: string
  counts: Record<string, number>
}

export interface DeletionPlan {
  org_id: string
  org_exists: boolean
  deletion_requested: boolean
  job: Pick<DeletionJobRow, 'id' | 'status' | 'step' | 'attempts' | 'last_error' | 'requested_via' | 'requested_at' | 'completed_at' | 'counts'> | null
  steps: PlannedStep[]
  retained: Array<{ what: string; where: string; source_rows: number; rule: string }>
  never_touched: string[]
}

const WHERE: Record<JobStepName, { where: string; what: string }> = {
  block_activity: { where: 'database, Supabase Auth', what: 'Mark the organization as being deleted, pause its agent, block its sign-in' },
  cancel_subscriptions: { where: 'Stripe', what: 'Expire open checkouts, cancel the plan and phone-number subscriptions (the customer record and its invoices are kept)' },
  release_numbers: { where: 'ElevenLabs, Cartesia, Twilio', what: 'Remove native and SIP imports, release the Twilio numbers' },
  collect_call_records: { where: 'database, ElevenLabs, Cartesia', what: 'Collect call record ids from the calls and texts, and list the agents’ conversations' },
  delete_agents: { where: 'ElevenLabs, Cartesia', what: 'Delete the agents (ownership checked by tag/marker first)' },
  delete_call_records: { where: 'ElevenLabs, Cartesia, Twilio', what: 'Delete conversations (transcripts, audio), Cartesia calls, Twilio call and message records' },
  delete_knowledge_copies: { where: 'ElevenLabs', what: 'Bulk-delete documents, website folders and the organization’s folder (force)' },
  delete_pronunciation: { where: 'ElevenLabs', what: 'Empty and archive the pronunciation dictionary' },
  delete_voices: { where: 'ElevenLabs', what: 'Delete the organization’s cloned and designed voices and their speech history' },
  revoke_google: { where: 'Google', what: 'Revoke the OAuth grants and erase the stored tokens' },
  delete_storage: { where: 'Supabase Storage', what: 'Remove knowledge-documents/<org_id>/' },
  archive_billing_records: { where: 'database', what: 'Copy invoices and monthly usage totals into the fiscal archive' },
  delete_organization: { where: 'database', what: 'Delete the organization row (every tenant table cascades)' },
  delete_auth_user: { where: 'Supabase Auth', what: 'Delete the sign-in, then email the confirmation' },
}

function head(db: SupabaseClient, table: string) {
  return db.from(table).select('*', { count: 'exact', head: true })
}

/** Top-level entries under <org_id>/ (one folder per agent): an indication, not a full count. */
async function storageObjects(db: SupabaseClient, orgId: string): Promise<Record<string, number>> {
  const { data, error } = await db.storage.from('knowledge-documents').list(orgId, { limit: 1000 })
  if (error) return /not found/i.test(error.message) ? { top_level_entries: 0 } : { unreadable: 1 }
  return { top_level_entries: (data ?? []).length }
}

export async function planAccountDeletion(orgId: string, db: SupabaseClient = createAdminClient()): Promise<DeletionPlan> {
  const [{ data: org, error: orgErr }, job] = await Promise.all([
    db.from('organizations').select('id, user_id, stripe_customer_id, stripe_subscription_id, deletion_requested_at').eq('id', orgId).maybeSingle(),
    latestJobFor(db, orgId),
  ])
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
  if (!org && !job) throw new RequestError('not_found', 'Organization not found.', 404)

  const jobSummary = job
    ? {
        id: job.id,
        status: job.status,
        step: job.step,
        attempts: job.attempts,
        last_error: job.last_error,
        requested_via: job.requested_via,
        requested_at: job.requested_at,
        completed_at: job.completed_at,
        counts: job.counts,
      }
    : null
  const neverTouched = [
    'Platform-wide library voices (provider_voices with owner_org_id NULL) and every other organization’s voices',
    'Platform webhook tools, the workspace tool secret, workspace webhooks and workspace settings',
    'The Stripe customer record and its invoices and payments (kept by Stripe)',
    'Events the agent booked in the owner’s own Google Calendar',
  ]
  if (!org) {
    return { org_id: orgId, org_exists: false, deletion_requested: true, job: jobSummary, steps: [], retained: [], never_touched: neverTouched }
  }

  const n = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string) => countOf(q, what)
  const [
    numberRows,
    agents,
    resources,
    calls,
    sms,
    docs,
    crawls,
    folders,
    voices,
    google,
    invoices,
    ledger,
    files,
  ] = await Promise.all([
    db.from('phone_numbers').select('twilio_sid, elevenlabs_phone_number_id, cartesia_phone_number_id, stripe_subscription_id').eq('org_id', orgId),
    db.from('agents').select('id, pronunciation').eq('org_id', orgId),
    db.from('agent_provider_resources').select('provider, external_id').eq('org_id', orgId),
    n(head(db, 'calls').eq('org_id', orgId), 'calls'),
    n(head(db, 'sms_messages').eq('org_id', orgId).not('twilio_sid', 'is', null), 'sms_messages'),
    n(head(db, 'knowledge_documents').eq('org_id', orgId).not('elevenlabs_doc_id', 'is', null), 'knowledge_documents'),
    n(head(db, 'knowledge_crawls').eq('org_id', orgId).not('root_folder_id', 'is', null), 'knowledge_crawls'),
    n(head(db, 'knowledge_folders').eq('org_id', orgId).not('folder_id', 'is', null), 'knowledge_folders'),
    n(head(db, 'provider_voices').eq('owner_org_id', orgId).eq('provider', 'elevenlabs').in('source', ['cloned', 'designed']).neq('status', 'deleted'), 'provider_voices'),
    n(head(db, 'integrations').eq('org_id', orgId).not('google_refresh_token', 'is', null), 'integrations'),
    n(head(db, 'invoices').eq('org_id', orgId), 'invoices'),
    n(head(db, 'usage_ledger').eq('org_id', orgId), 'usage_ledger'),
    storageObjects(db, orgId),
  ])
  for (const r of [numberRows, agents, resources]) if (r.error) throw new Error(`plan read failed: ${r.error.message}`)
  const numbers = (numberRows.data ?? []) as Array<Record<string, string | null>>
  const res = (resources.data ?? []) as Array<{ provider: string; external_id: string | null }>
  const subs = new Set<string>()
  if (org.stripe_subscription_id) subs.add(org.stripe_subscription_id as string)
  for (const x of numbers) if (x.stripe_subscription_id) subs.add(x.stripe_subscription_id)

  const counts: Record<JobStepName, Record<string, number>> = {
    block_activity: { agents: (agents.data ?? []).length, sign_in: org.user_id ? 1 : 0 },
    cancel_subscriptions: { stored_subscriptions: subs.size, stripe_customer: org.stripe_customer_id ? 1 : 0 },
    release_numbers: {
      numbers: numbers.length,
      twilio_numbers: numbers.filter((x) => x.twilio_sid && /^PN/i.test(x.twilio_sid)).length,
      elevenlabs_imports: numbers.filter((x) => x.elevenlabs_phone_number_id).length,
      cartesia_imports: numbers.filter((x) => x.cartesia_phone_number_id).length,
    },
    collect_call_records: { call_rows: calls, sms_rows_with_twilio_sid: sms },
    delete_agents: {
      elevenlabs_agents: res.filter((r) => r.provider === 'elevenlabs' && r.external_id).length,
      cartesia_agents: res.filter((r) => r.provider === 'cartesia' && r.external_id).length,
    },
    delete_call_records: { call_rows: calls, sms_rows_with_twilio_sid: sms },
    delete_knowledge_copies: { documents: docs, websites: crawls, org_folder: folders },
    delete_pronunciation: { dictionaries: (agents.data ?? []).filter((a) => !!(a.pronunciation as { dictionary_id?: string } | null)?.dictionary_id).length },
    delete_voices: { custom_voices: voices },
    revoke_google: { grants: google },
    delete_storage: files,
    archive_billing_records: { invoices, usage_ledger_rows: ledger },
    delete_organization: { organization: 1 },
    delete_auth_user: { sign_in: org.user_id ? 1 : 0 },
  }
  return {
    org_id: orgId,
    org_exists: true,
    deletion_requested: !!org.deletion_requested_at,
    job: jobSummary,
    steps: [...PREPARE_STEPS, ...DELETION_ORDER].map((step) => ({ step, ...WHERE[step], counts: counts[step] })),
    retained: [
      { what: 'invoices', where: 'invoices_archive (service role only)', source_rows: invoices, rule: 'Romanian accounting law 82/1991 art. 25: 10 years from the end of the financial year' },
      { what: 'monthly usage totals', where: 'usage_archive (service role only)', source_rows: ledger, rule: 'Supporting records of the invoiced minutes, same retention; no call ids or numbers' },
      { what: 'deletion record', where: 'account_deletions', source_rows: 1, rule: 'Proof of the erasure: ids, steps and counts only' },
    ],
    never_touched: neverTouched,
  }
}
