import 'server-only'
import type { Agent, ProviderSyncEntry } from '@/types'
import type { VoiceToolName } from '@/lib/voice/contracts'
import type {
  CartesiaAgentCreate,
  CartesiaAgentModel,
  CartesiaClientToolCreate,
  CartesiaClientToolParameters,
  CartesiaManagedAgent,
  CartesiaTool,
} from '@/lib/cartesia/types'
import { ApiError } from '@/lib/api/http'
import {
  CartesiaError,
  cartesia,
  cartesiaAgentModel,
  isCartesiaQuotaError,
  isCartesiaTransientError,
} from '@/lib/cartesia/client'
import { isCartesiaConfigured } from '@/lib/env'
import { kvDel, kvGet, kvIncr, kvSet } from '@/lib/kv'
import { sanitizeKeyterms } from '@/lib/voice/languages'
import { voiceStyleFor } from '@/lib/voice/tone'
import {
  CARTESIA_TOOL_PREFIX,
  TOOL_DEFINITIONS,
  VOICE_TOOL_NAMES,
  toCartesiaClientTool,
  toolsFor,
} from '@/lib/voice/tools/definitions'
import { defaultCartesiaVoice } from '@/lib/voice/voice-map'
import { configHash, stableStringify } from '@/lib/voice/sync/hash'
import {
  composeProviderAgentText,
  escapeDynamicVariables,
  providerAgentDescription,
  providerAgentName,
  safeTimeZone,
} from '@/lib/voice/sync/compose'
import type { AgentSyncContext, SyncOrg } from '@/lib/voice/sync/context'
import { forgetVoiceFacts, getVoiceFacts, type VoiceFacts } from '@/lib/voice/sync/voices'

// Cartesia Managed Agent per organisation agent: the path calls take once the
// monthly model credits run out (paid from voice-agent dollars). The gateway
// bridges Twilio audio to it and runs our client tools through the app, so the
// agent carries the same instructions, greeting, voice and tools as the
// self-run pipeline. Transfers go through our transfer_call client tool (the
// bridge owns the Twilio call), so Cartesia's transfer_to_number stays off.

/** Cartesia ships end_call as a system tool; every other tool is ours. */
export const MANAGED_TOOL_NAMES: readonly VoiceToolName[] = VOICE_TOOL_NAMES.filter((name) => name !== 'end_call')

export const CARTESIA_AGENT_MAX_OUTPUT_TOKENS = 400

const TOOL_CACHE_TTL_SECONDS = 600
const MODEL_CACHE_TTL_SECONDS = 3600
const TOOL_LOCK_TTL_SECONDS = 60
const TOOL_LOCK_WAIT_STEPS = 10
const TOOL_LOCK_WAIT_MS = 600

export interface CartesiaBuildFacts {
  /** Ids of our client tools. Without them the tool refs are the tool names, which is only meant for hashing. */
  toolIds?: Partial<Record<VoiceToolName, string>>
  /** Pro Voice Clones ignore speed, so none is sent. */
  voiceIsPro?: boolean
  /** true: the model has a fixed temperature (leave it out); false: send null (provider default); undefined/null: unknown, leave it out. */
  fixedTemperature?: boolean | null
  /** Voice to use when the agent's own voice no longer exists upstream. */
  voiceIdOverride?: string | null
}

/** A problem whose message is already written for the dashboard. */
export class ProviderSyncProblem extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderSyncProblem'
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Appended to the shared instructions for Managed Agents only: tool names
 * carry our prefix there, and nothing injects today's date or the caller's
 * number, so the model has to ask for them.
 */
export function managedModeNote(tools: readonly VoiceToolName[]): string {
  const example = tools.find((name) => name !== 'get_call_context') ?? 'get_call_context'
  const lines = [
    `Your tools are named with the prefix ${CARTESIA_TOOL_PREFIX}. The rules above use the plain names: ${example} means the tool ${CARTESIA_TOOL_PREFIX}${example}.`,
    `You don't know today's date, the current time, the business hours or the caller's number on your own. Call ${CARTESIA_TOOL_PREFIX}get_call_context at the start of the call whenever any of these could matter, and before you mention a date or time.`,
    'When the conversation is finished and you have said goodbye, end the call. Never end it while the caller still needs something.',
  ]
  return `# Phone system notes\n${lines.map((line) => `- ${line}`).join('\n')}`
}

export function buildCartesiaAgentConfig(
  agent: Agent,
  org: SyncOrg,
  ctx: AgentSyncContext,
  facts: CartesiaBuildFacts = {}
): CartesiaAgentCreate {
  const toolNames = toolsFor(ctx.capabilities, 'cartesia_managed').map((tool) => tool.name)
  const text = composeProviderAgentText(agent, org, ctx, toolNames)

  const tools = toolNames.map((name) => {
    if (!facts.toolIds) return { id: `${CARTESIA_TOOL_PREFIX}${name}` }
    const id = facts.toolIds[name]
    // Dropping a tool silently would take a capability away from live calls.
    if (!id) throw new Error(`Cartesia client tool id missing for ${name}`)
    return { id }
  })

  const style = voiceStyleFor({
    tone: text.tone,
    language: text.language,
    speed: agent.voice_speed,
    emotion: agent.voice_emotion,
  })
  const voiceId = facts.voiceIdOverride || agent.cartesia_voice_id || defaultCartesiaVoice(text.language).voice_id
  const dictionary = agent.metadata?.pronunciation_dict_id

  const model: NonNullable<CartesiaAgentCreate['config']['model']> = {
    id: cartesiaAgentModel(),
    max_output_tokens: CARTESIA_AGENT_MAX_OUTPUT_TOKENS,
  }
  // Same as the self-run pipeline: GPT-5.x runs at its default temperature.
  if (facts.fixedTemperature === false) model.temperature = null

  return {
    name: providerAgentName(org.name, agent.name),
    description: providerAgentDescription(org.id, agent.id),
    config: {
      instructions: escapeDynamicVariables(`${text.instructions}\n\n${managedModeNote(toolNames)}`),
      initial_message: escapeDynamicVariables(text.initialMessage),
      model,
      language: { primary: text.language },
      timezone: safeTimeZone(org.timezone),
      audio: {
        // Cartesia expands {{variables}} in keyterms too.
        input: { noise_suppression: 'auto', keyterms: sanitizeKeyterms(agent.keyterms ?? []).map(escapeDynamicVariables) },
        output: {
          voice_id: voiceId,
          speed: facts.voiceIsPro ? null : style.speed,
          volume: null,
          emotion: style.emotion,
          pronunciation_dictionary_id: typeof dictionary === 'string' && dictionary ? dictionary : null,
          background_sound: null,
        },
      },
      tools,
      system_tools: { end_call: {}, send_dtmf: null, transfer_to_number: null },
    },
  }
}

/** Digest of every client tool body we register, so definition changes reach Cartesia. */
export function clientToolsDigest(): string {
  return configHash(MANAGED_TOOL_NAMES.map((name) => toCartesiaClientTool(TOOL_DEFINITIONS[name]))).slice(0, 16)
}

/**
 * Hash of what a sync would push, computed from stored rows only (no provider
 * calls), so the daily resync can find stale agents cheaply.
 */
export function cartesiaSyncHash(agent: Agent, org: SyncOrg, ctx: AgentSyncContext): string {
  return configHash({ agent: buildCartesiaAgentConfig(agent, org, ctx), tools: clientToolsDigest() })
}

/** Last sync succeeded with this exact config. */
export function isEntryCurrent(entry: ProviderSyncEntry | undefined, hash: string): boolean {
  return !!entry && entry.hash === hash && !!entry.synced_at && !entry.error && entry.status !== 'disabled'
}

// ─── Client tools ────────────────────────────────────────────────────────────

function toolCacheKey(): string {
  return `cartesia:client-tools:${clientToolsDigest()}`
}

function normalizeParameters(parameters: CartesiaClientToolParameters | undefined): unknown {
  const properties = parameters?.properties ?? {}
  return {
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, prop]) => [
        key,
        { type: prop.type, description: prop.description ?? null, enum: prop.enum ?? null, items: prop.items ?? null },
      ])
    ),
    required: [...(parameters?.required ?? [])].sort(),
  }
}

/** Compares what we'd register with what Cartesia stores (it may reorder keys). */
export function clientToolDiffers(current: CartesiaTool, desired: CartesiaClientToolCreate): boolean {
  if (current.type !== 'client') return true
  return (
    current.description !== desired.description ||
    current.pre_tool_speech !== desired.pre_tool_speech ||
    current.execution_mode !== desired.execution_mode ||
    current.expects_response !== desired.expects_response ||
    (current.response_timeout_secs ?? 20) !== (desired.response_timeout_secs ?? 20) ||
    stableStringify(normalizeParameters(current.parameters)) !== stableStringify(normalizeParameters(desired.parameters))
  )
}

function isToolIdMap(value: unknown): value is Record<VoiceToolName, string> {
  if (!value || typeof value !== 'object') return false
  return MANAGED_TOOL_NAMES.every((name) => typeof (value as Record<string, unknown>)[name] === 'string')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Oldest tool per name wins, so a duplicate created by a race is never picked up later. */
function indexByName(tools: CartesiaTool[]): Map<string, CartesiaTool> {
  const byName = new Map<string, CartesiaTool>()
  for (const tool of [...tools].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (tool.type === 'client' && !byName.has(tool.name)) byName.set(tool.name, tool)
  }
  return byName
}

async function reconcileClientTools(): Promise<Record<VoiceToolName, string>> {
  let byName = indexByName(await cartesia.agents.tools.list({ type: 'client' }))
  const ids: Partial<Record<VoiceToolName, string>> = {}
  for (const name of MANAGED_TOOL_NAMES) {
    const desired = toCartesiaClientTool(TOOL_DEFINITIONS[name])
    const current = byName.get(desired.name)
    if (!current) {
      try {
        const created = await cartesia.agents.tools.create(desired)
        ids[name] = created.id
        console.info('[cartesia]', 'created client tool', desired.name)
      } catch (error) {
        // Another instance created it in the meantime.
        if (!(error instanceof CartesiaError && error.status === 409)) throw error
        byName = indexByName(await cartesia.agents.tools.list({ type: 'client' }))
        const raced = byName.get(desired.name)
        if (!raced) throw error
        ids[name] = raced.id
      }
      continue
    }
    if (clientToolDiffers(current, desired)) {
      await cartesia.agents.tools.update(current.id, {
        description: desired.description,
        pre_tool_speech: desired.pre_tool_speech,
        execution_mode: desired.execution_mode,
        expects_response: desired.expects_response,
        response_timeout_secs: desired.response_timeout_secs,
        parameters: desired.parameters,
      })
      console.info('[cartesia]', 'updated client tool', desired.name)
    }
    ids[name] = current.id
  }
  if (!isToolIdMap(ids)) throw new Error('Cartesia client tool reconciliation left tools without ids')
  return ids
}

/**
 * Makes sure every ntv_* client tool exists on the account with the current
 * definition and returns their ids. Tools are shared by all agents: editing one
 * changes it for every agent without a new agent version. Ids are cached for
 * ten minutes; a lock keeps two syncs from creating the same tool twice.
 */
export async function ensureClientTools(opts?: { fresh?: boolean }): Promise<Record<VoiceToolName, string>> {
  const key = toolCacheKey()
  if (!opts?.fresh) {
    const cached = await kvGet<Record<VoiceToolName, string>>(key)
    if (isToolIdMap(cached)) return cached
  }

  const lockKey = 'lock:cartesia-client-tools'
  const holders = await kvIncr(lockKey, TOOL_LOCK_TTL_SECONDS)
  if (holders > 1) {
    for (let step = 0; step < TOOL_LOCK_WAIT_STEPS; step++) {
      await sleep(TOOL_LOCK_WAIT_MS)
      const cached = await kvGet<Record<VoiceToolName, string>>(key)
      if (isToolIdMap(cached)) return cached
    }
    // The holder is slow or gone; reconciling again is safe (409s and duplicates are handled).
  }
  try {
    const ids = await reconcileClientTools()
    await kvSet(key, ids, TOOL_CACHE_TTL_SECONDS)
    return ids
  } finally {
    if (holders === 1) await kvDel(lockKey)
  }
}

export async function forgetClientToolCache(): Promise<void> {
  await kvDel(toolCacheKey())
}

// ─── Models ──────────────────────────────────────────────────────────────────

interface ModelFacts {
  /** false only when the list was read and the model isn't on it. */
  listed: boolean
  fixedTemperature: boolean | null
}

type ModelSummary = Pick<CartesiaAgentModel, 'id' | 'fixed_temperature'>

async function listAgentModels(): Promise<ModelSummary[] | null> {
  const key = 'cartesia:agent-models'
  const cached = await kvGet<ModelSummary[]>(key)
  if (Array.isArray(cached)) return cached
  try {
    const models = (await cartesia.agents.models()).map((m) => ({ id: m.id, fixed_temperature: m.fixed_temperature ?? null }))
    await kvSet(key, models, MODEL_CACHE_TTL_SECONDS)
    return models
  } catch (error) {
    // The model list only refines the payload; Cartesia validates the id on save anyway.
    console.warn('[cartesia]', 'agent model list unavailable', error instanceof Error ? error.message : error)
    return null
  }
}

async function agentModelFacts(modelId: string): Promise<ModelFacts> {
  const models = await listAgentModels()
  if (!models) return { listed: true, fixedTemperature: null }
  const model = models.find((m) => m.id === modelId)
  if (!model) return { listed: false, fixedTemperature: null }
  return { listed: true, fixedTemperature: model.fixed_temperature !== null && model.fixed_temperature !== undefined }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

const VOICE_GONE =
  'The voice you picked is no longer available, so backup calls use a default voice for now. Please choose another voice.'

export function describeCartesiaSyncError(error: unknown): string {
  if (error instanceof ProviderSyncProblem) return error.message
  if (error instanceof ApiError && error.code === 'not_configured') return 'Cartesia isn’t set up on the server yet.'
  if (isCartesiaQuotaError(error)) {
    return 'The voice provider refused the update because a usage limit was reached. We’ll try again automatically.'
  }
  if (error instanceof CartesiaError) {
    if (error.status === 401 || error.status === 403) {
      return 'The voice provider didn’t accept our account credentials. Please contact support.'
    }
    if (error.errorCode === 'agent_voice_not_found' || error.errorCode === 'voice_not_found') return VOICE_GONE
    if (error.errorCode === 'agent_tool_not_found' || error.errorCode === 'tool_not_found') {
      return 'A calling tool was missing at the voice provider. It will be recreated on the next update.'
    }
    if (isCartesiaTransientError(error)) return 'The voice provider didn’t respond in time. We’ll try again automatically.'
    if (error.status >= 400 && error.status < 500) {
      return 'The voice provider didn’t accept these agent settings. Please review your agent settings or contact support.'
    }
  }
  return 'Something went wrong while updating your voice agent. We’ll try again automatically.'
}

function isToolNotFound(error: unknown): boolean {
  return error instanceof CartesiaError && (error.errorCode === 'agent_tool_not_found' || error.errorCode === 'tool_not_found')
}

function isVoiceNotFound(error: unknown): boolean {
  return error instanceof CartesiaError && (error.errorCode === 'agent_voice_not_found' || error.errorCode === 'voice_not_found')
}

/** A managed agent we created earlier but never recorded (crash between create and the database write). */
async function findTaggedAgent(body: CartesiaAgentCreate): Promise<string | null> {
  const page = await cartesia.agents.list({ q: body.name, limit: 100 })
  return page.data.find((a) => a.description === body.description)?.id ?? null
}

async function pushAgent(existingId: string | null, body: CartesiaAgentCreate): Promise<CartesiaManagedAgent> {
  if (existingId) {
    try {
      return await cartesia.agents.update(existingId, body)
    } catch (error) {
      if (!(error instanceof CartesiaError && error.status === 404)) throw error
      console.warn('[cartesia]', 'managed agent missing upstream, creating a new one', existingId)
    }
  }
  const tagged = await findTaggedAgent(body)
  if (tagged) return cartesia.agents.update(tagged, body)
  return cartesia.agents.create(body)
}

export interface CartesiaSyncResult {
  entry: ProviderSyncEntry
  cartesiaAgentId: string | null
}

/**
 * Creates or updates the agent's Cartesia Managed Agent. Never throws: the
 * outcome, including a readable error, is returned for provider_sync.
 * `voice`: facts about the agent's voice when the caller already looked them
 * up (null = the voice doesn't exist upstream, undefined = the lookup failed).
 * Leave the key out entirely to have this function look the voice up.
 */
export async function syncCartesiaAgent(input: {
  agent: Agent
  org: SyncOrg
  ctx: AgentSyncContext
  voice?: VoiceFacts | null
  force?: boolean
  now?: Date
}): Promise<CartesiaSyncResult> {
  const { agent, org, ctx } = input
  const previous = agent.provider_sync?.cartesia
  const keep = { synced_at: previous?.synced_at ?? null, hash: previous?.hash ?? null, version_id: previous?.version_id ?? null }

  if (!isCartesiaConfigured()) {
    return { entry: { status: 'disabled', error: null, ...keep }, cartesiaAgentId: agent.cartesia_agent_id }
  }

  let hash: string
  try {
    hash = cartesiaSyncHash(agent, org, ctx)
  } catch (error) {
    console.error('[cartesia]', 'managed agent config could not be built', agent.id, error)
    return { entry: { status: 'error', error: describeCartesiaSyncError(error), ...keep }, cartesiaAgentId: agent.cartesia_agent_id }
  }

  if (!input.force && agent.cartesia_agent_id && previous && isEntryCurrent(previous, hash)) {
    return { entry: { ...previous, status: 'synced' }, cartesiaAgentId: agent.cartesia_agent_id }
  }

  try {
    const modelId = cartesiaAgentModel()
    const model = await agentModelFacts(modelId)
    if (!model.listed) {
      console.error('[cartesia]', 'configured agent model is not offered', modelId)
      throw new ProviderSyncProblem('The AI model set up for backup calls isn’t offered by the voice provider. Please contact support.')
    }

    const voiceId = agent.cartesia_voice_id || defaultCartesiaVoice(agent.language).voice_id
    const defaultVoiceId = defaultCartesiaVoice(agent.language).voice_id
    // A caller that already tried (and maybe failed) the lookup passes the key;
    // looking up again would double a slow provider timeout inside after().
    let voice: VoiceFacts | null | undefined = input.voice
    if (!('voice' in input)) {
      voice = await getVoiceFacts(voiceId).catch((error: unknown) => {
        console.warn('[cartesia]', 'voice lookup failed during sync', voiceId, error instanceof Error ? error.message : error)
        return undefined
      })
    }
    let voiceGone = voice === null
    let facts: CartesiaBuildFacts = {
      voiceIsPro: voice?.is_pro ?? false,
      fixedTemperature: model.fixedTemperature,
      voiceIdOverride: voiceGone ? defaultVoiceId : null,
    }

    let toolIds = await ensureClientTools()
    let refreshedTools = false
    let saved: CartesiaManagedAgent
    // At most three attempts: each recovery below runs once.
    for (;;) {
      try {
        saved = await pushAgent(agent.cartesia_agent_id, buildCartesiaAgentConfig(agent, org, ctx, { ...facts, toolIds }))
        break
      } catch (error) {
        if (isToolNotFound(error) && !refreshedTools) {
          // A cached tool id went stale (tool deleted upstream): rebuild the tool set once.
          refreshedTools = true
          await forgetClientToolCache()
          toolIds = await ensureClientTools({ fresh: true })
          continue
        }
        if (isVoiceNotFound(error) && !voiceGone && voiceId !== defaultVoiceId) {
          // The lookup missed it (cached or failed) but Cartesia says the voice is
          // gone: keep backup calls working on the default voice and tell the owner.
          voiceGone = true
          facts = { ...facts, voiceIsPro: false, voiceIdOverride: defaultVoiceId }
          await forgetVoiceFacts(voiceId)
          continue
        }
        throw error
      }
    }

    return {
      entry: {
        status: voiceGone ? 'error' : 'synced',
        synced_at: (input.now ?? new Date()).toISOString(),
        error: voiceGone ? VOICE_GONE : null,
        hash,
        version_id: saved.version?.id ?? null,
      },
      cartesiaAgentId: saved.id,
    }
  } catch (error) {
    console.error('[cartesia]', 'managed agent sync failed', {
      agent: agent.id,
      message: error instanceof Error ? error.message : String(error),
      status: error instanceof CartesiaError ? error.status : null,
      code: error instanceof CartesiaError ? error.errorCode : null,
      request_id: error instanceof CartesiaError ? error.requestId : null,
    })
    return {
      entry: { status: 'error', error: describeCartesiaSyncError(error), ...keep },
      cartesiaAgentId: agent.cartesia_agent_id,
    }
  }
}

/** Deletes a managed agent; an agent that is already gone counts as deleted. */
export async function deleteCartesiaAgent(cartesiaAgentId: string): Promise<void> {
  try {
    await cartesia.agents.delete(cartesiaAgentId)
  } catch (error) {
    if (error instanceof CartesiaError && error.status === 404) return
    throw error
  }
}
