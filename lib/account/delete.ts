import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAgentDefaults } from '@/lib/api/auth'
import { env, isCartesiaConfigured, isElevenLabsConfigured, isStripeConfigured, isTwilioConfigured } from '@/lib/env'
import { getStripeClient } from '@/lib/stripe/client'
import { PHONE_NUMBER_SID_REGEX, RECORDING_SID_REGEX, getTwilioClient, isTwilioNotFound, twilioErrorInfo } from '@/lib/twilio/client'
import { deleteRecording } from '@/lib/twilio/calls'
import { CartesiaError, cartesia } from '@/lib/cartesia/client'
import { deleteAgentProviders } from '@/lib/voice/sync'
import { revokeGoogleAccess } from '@/lib/google/client'
import {
  AccountDeletionError,
  runDeletionPlan,
  type DeletionStepName,
  type DeletionStep,
  type DeletionStepResult,
} from '@/lib/account/deletion-plan'
import type { Agent } from '@/types'

// Closes an organisation for good: billing, phone numbers, provider copies of
// the agent, voices, documents and call records, Google access, stored files,
// every database row (organizations cascades) and finally the sign-in. The
// order and the continue-on-provider-error policy live in deletion-plan.ts.

export { AccountDeletionError } from '@/lib/account/deletion-plan'

// Every private bucket that keeps per-organisation files under `<org_id>/`
// (knowledge uploads, clone recordings, spoken previews, Voice Lab uploads).
const STORAGE_BUCKETS = ['knowledge-documents', 'voice-clips', 'voice-previews', 'voice-lab-uploads'] as const
const CALL_RECORD_BUDGET_MS = 90_000
const PROVIDER_CONCURRENCY = 4
const MAX_CALL_ROWS = 10_000
const MAX_STORAGE_FILES = 20_000
const ELEVENLABS_API = 'https://api.elevenlabs.io'

export interface OrgInventory {
  org: {
    id: string
    user_id: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
  }
  agents: Agent[]
  numbers: { id: string; twilio_sid: string | null; elevenlabs_phone_number_id: string | null; stripe_subscription_id: string | null }[]
  clones: { id: string; cartesia_voice_id: string; elevenlabs_voice_id: string | null; source_storage_path: string | null; status: string }[]
  documents: {
    id: string
    storage_path: string | null
    extracted_text_path: string | null
    cartesia_doc_id: string | null
    elevenlabs_doc_id: string | null
    provider_sync?: unknown
  }[]
  calls: {
    id: string
    recording_sid: string | null
    provider_call_id: string | null
    voice_provider: string | null
    pipeline_mode: string | null
    elevenlabs_conversation_id: string | null
  }[]
}

// ─── Small helpers ────────────────────────────────────────────────────────────

type PgError = { code?: string; message?: string } | null

function isMissingColumn(error: PgError): boolean {
  return error?.code === '42703'
}

function isMissingTable(error: PgError): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/**
 * Reads an org's rows, tolerating databases where migration 010 isn't applied
 * yet (new columns fall back to legacy ones, new tables read as empty).
 */
async function selectOrgRows<T>(
  admin: SupabaseClient,
  table: string,
  orgId: string,
  columns: string,
  opts: { legacyColumns?: string; max?: number } = {}
): Promise<T[]> {
  const max = opts.max ?? 1000
  const pageSize = Math.min(1000, max)
  const rows: T[] = []
  let cols = columns
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(cols)
      .eq('org_id', orgId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) {
      if (isMissingColumn(error) && opts.legacyColumns && cols !== opts.legacyColumns) {
        cols = opts.legacyColumns
        from -= pageSize
        continue
      }
      if (isMissingTable(error)) return rows
      throw new Error(`Could not read ${table} (${error.code ?? 'unknown'})`)
    }
    const page = (data ?? []) as unknown as T[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

/** Runs fn over items with bounded concurrency; stops starting new work after the deadline. */
async function forEachLimited<T>(
  items: readonly T[],
  fn: (item: T) => Promise<void>,
  opts: { concurrency?: number; deadline?: number } = {}
): Promise<{ done: number; failed: number; skipped: number }> {
  let index = 0
  let done = 0
  let failed = 0
  const concurrency = Math.max(1, opts.concurrency ?? PROVIDER_CONCURRENCY)
  const worker = async () => {
    while (index < items.length) {
      if (opts.deadline && Date.now() > opts.deadline) return
      const item = items[index++]
      try {
        await fn(item)
        done++
      } catch {
        failed++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return { done, failed, skipped: items.length - done - failed }
}

function summarize(noun: string, result: { done: number; failed: number; skipped: number }, total: number): string {
  if (total === 0) return `no ${noun}`
  const parts = [`${result.done} of ${total} ${noun} removed`]
  if (result.failed) parts.push(`${result.failed} failed`)
  if (result.skipped) parts.push(`${result.skipped} not attempted (time budget)`)
  const text = parts.join(', ')
  if (result.failed || result.skipped) throw new Error(text)
  return text
}

async function elevenLabsDelete(path: string): Promise<void> {
  const key = env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ElevenLabs is not configured')
  const res = await fetch(`${ELEVENLABS_API}${path}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': key },
    signal: AbortSignal.timeout(10_000),
  })
  // Already gone counts as deleted.
  if (res.ok || res.status === 404) return
  throw new Error(`ElevenLabs responded ${res.status}`)
}

function isCartesiaNotFound(error: unknown): boolean {
  return error instanceof CartesiaError && error.status === 404
}

function logProviderError(tag: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[account] ${tag}`, message.slice(0, 200))
}

// ─── Inventory ────────────────────────────────────────────────────────────────

async function loadInventory(admin: SupabaseClient, orgId: string): Promise<OrgInventory> {
  const { data: org, error } = await admin
    .from('organizations')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw new Error(`Could not read the organization (${error.code ?? 'unknown'})`)
  if (!org) throw new Error('Organization not found')

  const [agentRows, numbers, clones, documents, calls] = await Promise.all([
    selectOrgRows<Record<string, unknown>>(admin, 'agents', orgId, '*'),
    selectOrgRows<OrgInventory['numbers'][number]>(
      admin,
      'phone_numbers',
      orgId,
      'id, twilio_sid, elevenlabs_phone_number_id, stripe_subscription_id',
      { legacyColumns: 'id, twilio_sid, elevenlabs_phone_number_id' }
    ),
    selectOrgRows<OrgInventory['clones'][number]>(
      admin,
      'voice_clones',
      orgId,
      'id, cartesia_voice_id, elevenlabs_voice_id, source_storage_path, status'
    ),
    selectOrgRows<OrgInventory['documents'][number]>(
      admin,
      'knowledge_documents',
      orgId,
      'id, storage_path, extracted_text_path, cartesia_doc_id, elevenlabs_doc_id, provider_sync',
      { legacyColumns: 'id, storage_path, elevenlabs_doc_id' }
    ),
    selectOrgRows<OrgInventory['calls'][number]>(
      admin,
      'calls',
      orgId,
      'id, recording_sid, provider_call_id, voice_provider, pipeline_mode, elevenlabs_conversation_id',
      { legacyColumns: 'id, elevenlabs_conversation_id', max: MAX_CALL_ROWS }
    ),
  ])

  return {
    org: {
      id: org.id as string,
      user_id: org.user_id as string,
      stripe_customer_id: (org.stripe_customer_id as string | null) ?? null,
      stripe_subscription_id: (org.stripe_subscription_id as string | null) ?? null,
    },
    agents: agentRows.map((row) => withAgentDefaults(row)),
    numbers: numbers.map((n) => ({ ...n, stripe_subscription_id: n.stripe_subscription_id ?? null })),
    clones,
    documents: documents.map((d) => ({ ...d, extracted_text_path: d.extracted_text_path ?? null, cartesia_doc_id: d.cartesia_doc_id ?? null })),
    calls: calls
      .map((c) => ({
        id: c.id,
        recording_sid: c.recording_sid ?? null,
        provider_call_id: c.provider_call_id ?? null,
        voice_provider: c.voice_provider ?? null,
        pipeline_mode: c.pipeline_mode ?? null,
        elevenlabs_conversation_id: c.elevenlabs_conversation_id ?? null,
      }))
      .filter((c) => c.recording_sid || c.provider_call_id || c.elevenlabs_conversation_id),
  }
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const cancelSubscriptions: DeletionStep<OrgInventory> = async ({ org, numbers }) => {
  const ids = new Set<string>()
  if (org.stripe_subscription_id) ids.add(org.stripe_subscription_id)
  for (const n of numbers) if (n.stripe_subscription_id) ids.add(n.stripe_subscription_id)
  if (!org.stripe_customer_id && ids.size === 0) return 'no subscriptions'
  if (!isStripeConfigured()) throw new Error(`Stripe is not configured; ${ids.size} subscription(s) could not be cancelled`)

  const stripe = getStripeClient()
  // Catch subscriptions we never stored (a checkout whose webhook was lost).
  if (org.stripe_customer_id) {
    const list = await stripe.subscriptions.list({ customer: org.stripe_customer_id, status: 'all', limit: 100 })
    for (const sub of list.data) {
      if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') ids.add(sub.id)
    }
  }

  const result = await forEachLimited([...ids], async (id) => {
    try {
      await stripe.subscriptions.cancel(id)
    } catch (error) {
      const e = error as { code?: string; message?: string }
      // Already cancelled or deleted in Stripe.
      if (e.code === 'resource_missing') return
      if (typeof e.message === 'string' && /canceled subscription/i.test(e.message)) return
      logProviderError('stripe cancel failed', error)
      throw error
    }
  })
  return summarize('subscriptions', result, ids.size)
}

const releaseNumbers: DeletionStep<OrgInventory> = async ({ numbers }) => {
  const twilioNumbers = numbers.filter((n) => n.twilio_sid && PHONE_NUMBER_SID_REGEX.test(n.twilio_sid))
  const elevenLabsImports = numbers.filter((n) => n.elevenlabs_phone_number_id)
  if (twilioNumbers.length === 0 && elevenLabsImports.length === 0) return 'no phone numbers'

  if (elevenLabsImports.length > 0 && isElevenLabsConfigured()) {
    await forEachLimited(elevenLabsImports, async (n) => {
      try {
        await elevenLabsDelete(`/v1/convai/phone-numbers/${encodeURIComponent(n.elevenlabs_phone_number_id as string)}`)
      } catch (error) {
        // The Twilio release below is what stops the number; this is cleanup.
        logProviderError('elevenlabs phone import delete failed', error)
        throw error
      }
    })
  }

  if (twilioNumbers.length === 0) return 'no Twilio numbers'
  if (!isTwilioConfigured()) throw new Error(`Twilio is not configured; ${twilioNumbers.length} number(s) were not released`)
  const client = getTwilioClient()
  const result = await forEachLimited(twilioNumbers, async (n) => {
    try {
      await client.incomingPhoneNumbers(n.twilio_sid as string).remove()
    } catch (error) {
      if (isTwilioNotFound(error)) return
      const info = twilioErrorInfo(error)
      console.error('[account] twilio number release failed', info.status, info.code)
      throw error
    }
  })
  return summarize('phone numbers', result, twilioNumbers.length)
}

/**
 * Every provider copy of a document: large documents are split into several
 * Cartesia parts (provider_sync.cartesia.doc_ids, cartesia_doc_id is the first),
 * and a replaced ElevenLabs copy can still be waiting for deletion.
 */
export function knowledgeProviderIds(doc: OrgInventory['documents'][number]): { cartesia: string[]; elevenlabs: string[] } {
  const sync = (doc.provider_sync && typeof doc.provider_sync === 'object' ? doc.provider_sync : {}) as {
    cartesia?: { doc_ids?: unknown }
    elevenlabs?: { stale_doc_id?: unknown }
  }
  const parts = Array.isArray(sync.cartesia?.doc_ids) ? sync.cartesia.doc_ids.filter((id): id is string => typeof id === 'string') : []
  const stale = typeof sync.elevenlabs?.stale_doc_id === 'string' ? sync.elevenlabs.stale_doc_id : null
  return {
    cartesia: [...new Set([doc.cartesia_doc_id, ...parts].filter((id): id is string => !!id))],
    elevenlabs: [...new Set([doc.elevenlabs_doc_id, stale].filter((id): id is string => !!id))],
  }
}

const deleteKnowledgeCopies: DeletionStep<OrgInventory> = async ({ documents }) => {
  const ids = documents.map(knowledgeProviderIds)
  const cartesiaDocs = ids.flatMap((d) => d.cartesia).map((cartesia_doc_id) => ({ cartesia_doc_id }))
  const elevenLabsDocs = ids.flatMap((d) => d.elevenlabs).map((elevenlabs_doc_id) => ({ elevenlabs_doc_id }))
  const total = cartesiaDocs.length + elevenLabsDocs.length
  if (total === 0) return 'no provider documents'

  let done = 0
  let failed = 0
  if (cartesiaDocs.length > 0) {
    if (!isCartesiaConfigured()) failed += cartesiaDocs.length
    else {
      const r = await forEachLimited(cartesiaDocs, async (d) => {
        try {
          await cartesia.knowledge.deleteDocument(d.cartesia_doc_id as string)
        } catch (error) {
          if (isCartesiaNotFound(error)) return
          logProviderError('cartesia document delete failed', error)
          throw error
        }
      })
      done += r.done
      failed += r.failed + r.skipped
    }
  }
  if (elevenLabsDocs.length > 0) {
    if (!isElevenLabsConfigured()) failed += elevenLabsDocs.length
    else {
      const r = await forEachLimited(elevenLabsDocs, async (d) => {
        try {
          // force: documents still attached to the standby agent are deleted too.
          await elevenLabsDelete(`/v1/convai/knowledge-base/${encodeURIComponent(d.elevenlabs_doc_id as string)}?force=true`)
        } catch (error) {
          logProviderError('elevenlabs document delete failed', error)
          throw error
        }
      })
      done += r.done
      failed += r.failed + r.skipped
    }
  }
  return summarize('provider documents', { done, failed, skipped: 0 }, total)
}

const deleteAgents: DeletionStep<OrgInventory> = async ({ agents }) => {
  if (agents.length === 0) return 'no agents'
  const result = await forEachLimited(
    agents,
    async (agent) => {
      try {
        await deleteAgentProviders(agent)
      } catch (error) {
        logProviderError('agent provider delete failed', error)
        throw error
      }
    },
    { concurrency: 1 }
  )
  return summarize('agents', result, agents.length)
}

const deleteVoices: DeletionStep<OrgInventory> = async ({ clones }) => {
  const live = clones.filter((c) => c.status !== 'deleted')
  if (live.length === 0) return 'no cloned voices'
  const result = await forEachLimited(live, async (clone) => {
    if (!isCartesiaConfigured()) throw new Error('Cartesia is not configured')
    try {
      await cartesia.voices.delete(clone.cartesia_voice_id)
    } catch (error) {
      if (!isCartesiaNotFound(error)) {
        logProviderError('cartesia voice delete failed', error)
        throw error
      }
    }
    if (clone.elevenlabs_voice_id) {
      if (!isElevenLabsConfigured()) throw new Error('ElevenLabs is not configured')
      await elevenLabsDelete(`/v1/voices/${encodeURIComponent(clone.elevenlabs_voice_id)}`).catch((error: unknown) => {
        logProviderError('elevenlabs voice delete failed', error)
        throw error
      })
    }
  })
  return summarize('cloned voices', result, live.length)
}

const deleteCallRecords: DeletionStep<OrgInventory> = async ({ calls }) => {
  const recordings = calls.filter((c) => c.recording_sid && RECORDING_SID_REGEX.test(c.recording_sid))
  const managed = calls.filter((c) => c.voice_provider === 'cartesia' && c.pipeline_mode === 'cartesia_managed' && c.provider_call_id)
  const conversations = [
    ...new Set(
      calls
        .map((c) => c.elevenlabs_conversation_id ?? (c.voice_provider === 'elevenlabs' ? c.provider_call_id : null))
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const total = recordings.length + managed.length + conversations.length
  if (total === 0) return 'no provider call records'

  const deadline = Date.now() + CALL_RECORD_BUDGET_MS
  const outcome = { done: 0, failed: 0, skipped: 0 }
  const add = (r: { done: number; failed: number; skipped: number }) => {
    outcome.done += r.done
    outcome.failed += r.failed
    outcome.skipped += r.skipped
  }

  if (recordings.length > 0) {
    if (!isTwilioConfigured()) outcome.failed += recordings.length
    else add(await forEachLimited(recordings, (c) => deleteRecording(c.recording_sid as string), { deadline }))
  }
  if (managed.length > 0) {
    if (!isCartesiaConfigured()) outcome.failed += managed.length
    else
      add(
        await forEachLimited(
          managed,
          async (c) => {
            try {
              await cartesia.calls.delete(c.provider_call_id as string)
            } catch (error) {
              if (isCartesiaNotFound(error)) return
              logProviderError('cartesia call delete failed', error)
              throw error
            }
          },
          { deadline }
        )
      )
  }
  if (conversations.length > 0) {
    if (!isElevenLabsConfigured()) outcome.failed += conversations.length
    else
      add(
        await forEachLimited(
          conversations,
          async (id) => {
            try {
              await elevenLabsDelete(`/v1/convai/conversations/${encodeURIComponent(id)}`)
            } catch (error) {
              logProviderError('elevenlabs conversation delete failed', error)
              throw error
            }
          },
          { deadline }
        )
      )
  }
  return summarize('provider call records', outcome, total)
}

const revokeGoogle: DeletionStep<OrgInventory> = async ({ org }) => {
  // Never throws; stored tokens are cleared even when Google's revoke fails.
  const result = await revokeGoogleAccess(org.id)
  if (result.failed > 0) throw new Error(`${result.failed} Google grant(s) could not be revoked (stored tokens cleared)`)
  return result.revoked > 0 ? `${result.revoked} Google grant(s) revoked` : 'no Google access'
}

async function listStorageFiles(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[] | null> {
  const files: string[] = []
  const folders = [prefix]
  while (folders.length > 0 && files.length < MAX_STORAGE_FILES) {
    const folder = folders.shift() as string
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000, offset })
      if (error) {
        if (/bucket not found/i.test(error.message)) return null
        throw new Error(`Could not list ${bucket} (${error.message.slice(0, 80)})`)
      }
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`
        // Folders come back without an id.
        if (entry.id === null) folders.push(path)
        else files.push(path)
      }
      if (!data || data.length < 1000) break
    }
  }
  return files
}

function makeDeleteStorage(admin: SupabaseClient): DeletionStep<OrgInventory> {
  return async ({ org, documents, clones }) => {
    // Paths recorded on rows that don't sit under the org folder (older uploads).
    const extra: Record<(typeof STORAGE_BUCKETS)[number], string[]> = {
      'knowledge-documents': documents.flatMap((d) => [d.storage_path, d.extracted_text_path]).filter((p): p is string => Boolean(p)),
      'voice-clips': clones.map((c) => c.source_storage_path).filter((p): p is string => Boolean(p)),
      'voice-previews': [],
      'voice-lab-uploads': [],
    }
    let removed = 0
    const failures: string[] = []
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const listed = await listStorageFiles(admin, bucket, org.id)
        if (listed === null) continue
        const paths = [...new Set([...listed, ...extra[bucket].filter((p) => !p.startsWith(`${org.id}/`))])]
        for (let i = 0; i < paths.length; i += 100) {
          const batch = paths.slice(i, i + 100)
          const { error } = await admin.storage.from(bucket).remove(batch)
          if (error) throw new Error(`Could not remove files from ${bucket} (${error.message.slice(0, 80)})`)
          removed += batch.length
        }
      } catch (error) {
        logProviderError(`storage cleanup failed for ${bucket}`, error)
        failures.push(bucket)
      }
    }
    if (failures.length > 0) throw new Error(`${removed} files removed; cleanup failed for ${failures.join(', ')}`)
    return `${removed} files removed`
  }
}

function makeDeleteOrganization(admin: SupabaseClient): DeletionStep<OrgInventory> {
  return async ({ org }) => {
    const { error } = await admin.from('organizations').delete().eq('id', org.id)
    if (error) throw new Error(`Organization delete failed (${error.code ?? 'unknown'})`)
    return 'organization and all its rows deleted'
  }
}

function makeDeleteAuthUser(admin: SupabaseClient): DeletionStep<OrgInventory> {
  return async ({ org }) => {
    const { error } = await admin.auth.admin.deleteUser(org.user_id)
    if (error && error.status !== 404) throw new Error(`Sign-in delete failed (${error.status ?? 'unknown'})`)
    return 'sign-in deleted'
  }
}

/**
 * Deletes everything that belongs to an organisation. Provider failures are
 * logged and skipped; throws AccountDeletionError when the account can't be
 * read, or when the organization row or the sign-in can't be deleted.
 */
export async function deleteOrganizationData(orgId: string): Promise<void> {
  const admin = createAdminClient()
  const steps: Record<DeletionStepName, DeletionStep<OrgInventory>> = {
    cancel_subscriptions: cancelSubscriptions,
    release_numbers: releaseNumbers,
    delete_knowledge_copies: deleteKnowledgeCopies,
    delete_agents: deleteAgents,
    delete_voices: deleteVoices,
    delete_call_records: deleteCallRecords,
    revoke_google: revokeGoogle,
    delete_storage: makeDeleteStorage(admin),
    delete_organization: makeDeleteOrganization(admin),
    delete_auth_user: makeDeleteAuthUser(admin),
  }

  const results: DeletionStepResult[] = await runDeletionPlan({
    orgId,
    loadInventory: () => loadInventory(admin, orgId),
    steps,
    log: (entry) => {
      const line = JSON.stringify(entry)
      if (entry.ok) console.info('[account] deletion step', line)
      else console.error('[account] deletion step failed', line)
    },
  })

  const failed = results.filter((r) => !r.ok).map((r) => r.step)
  console.info('[account] organization deleted', JSON.stringify({ org_id: orgId, incomplete_steps: failed }))
}

export function isAccountDeletionError(error: unknown): error is AccountDeletionError {
  return error instanceof AccountDeletionError
}
