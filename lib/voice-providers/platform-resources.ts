import 'server-only'
// Platform-level provider resources shared by every organization, created on
// first use and remembered in `platform_resources` (service role only):
//   elevenlabs.transfer_tool   webhook tool → /api/telephony/tools/transfer
//   cartesia.sip_provider      SIP trunk provider our Twilio ingress dials into
//   cartesia.call_webhook      call-event webhook → /api/cartesia/webhook
//   cartesia.context_tool      webhook tool → /api/telephony/tools/cartesia-context
// An env var with the external id takes precedence (pre-provisioned setups).

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/observability/logger'
import { publicBaseUrl, cartesiaSip } from './config'
import { ProviderError } from './errors'
import * as el from '@/lib/elevenlabs/client'
import * as cartesia from '@/lib/cartesia/client'
import { transferToolConfig } from '@/lib/elevenlabs/agent-config'
import { contextToolDefinition } from '@/lib/cartesia/agent-config'

const log = createLogger({ component: 'platform_resources' })

export type PlatformResourceKey =
  | 'elevenlabs.transfer_tool'
  | 'cartesia.sip_provider'
  | 'cartesia.call_webhook'
  | 'cartesia.context_tool'

const ENV_OVERRIDE: Record<PlatformResourceKey, string> = {
  'elevenlabs.transfer_tool': 'ELEVENLABS_TRANSFER_TOOL_ID',
  'cartesia.sip_provider': 'CARTESIA_SIP_PROVIDER_ID',
  'cartesia.call_webhook': 'CARTESIA_WEBHOOK_ID',
  'cartesia.context_tool': 'CARTESIA_CONTEXT_TOOL_ID',
}

const memo = new Map<PlatformResourceKey, string>()

async function read(key: PlatformResourceKey): Promise<string | null> {
  const env = (process.env[ENV_OVERRIDE[key]] ?? '').trim()
  if (env) return env
  if (memo.has(key)) return memo.get(key) as string
  const { data, error } = await createAdminClient().from('platform_resources').select('external_id').eq('key', key).maybeSingle()
  if (error) throw new Error(`platform_resources read failed: ${error.message}`)
  if (data?.external_id) memo.set(key, data.external_id as string)
  return (data?.external_id as string | undefined) ?? null
}

async function remember(key: PlatformResourceKey, provider: string, externalId: string, details: Record<string, unknown> = {}) {
  const { error } = await createAdminClient()
    .from('platform_resources')
    .upsert({ key, provider, external_id: externalId, details, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`platform_resources write failed: ${error.message}`)
  memo.set(key, externalId)
}

function requireBase(operation: string, system: 'elevenlabs' | 'cartesia'): string {
  const base = publicBaseUrl()
  if (!base) throw new ProviderError({ system, operation, code: 'not_configured', detail: 'VOICE_PUBLIC_BASE_URL missing' })
  return base
}

/** Returns the id of the resource, creating it once if needed. Returns null when its prerequisites are missing. */
export async function ensurePlatformResource(key: PlatformResourceKey): Promise<string | null> {
  const existing = await read(key)
  if (existing) return existing

  switch (key) {
    case 'elevenlabs.transfer_tool': {
      if (!el.isConfigured()) return null
      const base = requireBase('tools.create', 'elevenlabs')
      const created = await el.tools.create(transferToolConfig(`${base}/api/telephony/tools/transfer`))
      await remember(key, 'elevenlabs', created.id)
      log.info('platform_resource.created', { key, provider: 'elevenlabs', externalId: created.id })
      return created.id
    }
    case 'cartesia.sip_provider': {
      const sip = cartesiaSip()
      if (!cartesia.isConfigured() || !sip.username || !sip.password) return null
      const created = await cartesia.telephony.createSipProvider({
        label: 'neuro-tech-voice twilio ingress',
        inbound: { credentials: { username: sip.username, password: sip.password }, media_encryption: 'allowed' },
      })
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
    case 'cartesia.call_webhook': {
      const secret = (process.env.CARTESIA_WEBHOOK_SECRET ?? '').trim()
      if (!cartesia.isConfigured() || secret.length < 24) return null
      const base = requireBase('webhooks.create', 'cartesia')
      const created = await cartesia.webhooks.create({ url: `${base}/api/cartesia/webhook`, secret, display_name: 'neuro-tech-voice call events' })
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
    case 'cartesia.context_tool': {
      const toolSecret = (process.env.CARTESIA_TOOL_SECRET ?? '').trim()
      if (!cartesia.isConfigured() || toolSecret.length < 24) return null
      const base = requireBase('tools.create', 'cartesia')
      const created = await cartesia.tools.create(contextToolDefinition(`${base}/api/telephony/tools/cartesia-context`, toolSecret))
      await remember(key, 'cartesia', created.id)
      log.info('platform_resource.created', { key, provider: 'cartesia', externalId: created.id })
      return created.id
    }
  }
}

/** Same as ensurePlatformResource but never throws (logs and returns null). */
export async function tryPlatformResource(key: PlatformResourceKey): Promise<string | null> {
  try {
    return await ensurePlatformResource(key)
  } catch (err) {
    log.error('platform_resource.ensure_failed', err, { key })
    return null
  }
}

/** For diagnostics: which platform resources exist (ids only). */
export async function listPlatformResources(): Promise<Record<PlatformResourceKey, string | null>> {
  const keys = Object.keys(ENV_OVERRIDE) as PlatformResourceKey[]
  const out = {} as Record<PlatformResourceKey, string | null>
  for (const k of keys) {
    try {
      out[k] = await read(k)
    } catch (err) {
      log.error('platform_resource.read_failed', err, { key: k })
      out[k] = null
    }
  }
  return out
}

/**
 * Drops a stored resource id that the provider says no longer exists, so the
 * next ensurePlatformResource() recreates it. Env-pinned ids are left alone
 * (the operator owns them); failures are logged, never thrown.
 */
export async function forgetPlatformResource(key: PlatformResourceKey): Promise<void> {
  memo.delete(key)
  if ((process.env[ENV_OVERRIDE[key]] ?? '').trim()) {
    log.warn('platform_resource.pinned_missing', { key })
    return
  }
  const { error } = await createAdminClient().from('platform_resources').delete().eq('key', key)
  if (error) log.error('platform_resource.forget_failed', error, { key })
  else log.warn('platform_resource.forgotten', { key })
}
