// Which conversation_config_override fields an agent accepts at call start
// (platform_settings.overrides.conversation_config_override, AgentConfigOverrideConfig
// & co. in the spec). ElevenLabs refuses to start a conversation whose client
// data overrides a field the agent does not allow, so a call-start path may
// only send an override the agent ALREADY has at the provider: during a
// config rollout (batched) many agents still carry the previous allow-list.
//
// The sync records the allow-list it pushed in agent_provider_resources.details
// (`client_overrides: {version, paths}`), next to `platform_version`. It is
// trusted only while both versions agree: an older deployment re-syncing the
// agent rewrites platform_version but not this key, which then reads as stale.
// Pure.

import type { AgentBody } from './client'
import { PLATFORM_AGENT_CONFIG_VERSION } from './agent-config'

export const OVERRIDE_FIRST_MESSAGE = 'agent.first_message'
export const OVERRIDE_MAX_DURATION = 'conversation.max_duration_seconds'

/** Dotted paths of the override fields `body` allows (true leaves only). */
export function allowedOverridePaths(body: Pick<AgentBody, 'platform_settings'>): string[] {
  const root = (body.platform_settings.overrides as { conversation_config_override?: unknown } | undefined)?.conversation_config_override
  const out: string[] = []
  const walk = (node: unknown, prefix: string) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k
      if (v === true) out.push(path)
      else walk(v, path)
    }
  }
  walk(root, '')
  return out.sort()
}

/** The details entry the sync stores with each ElevenLabs write. */
export function clientOverridesDetail(body: Pick<AgentBody, 'platform_settings'>): { version: number; paths: string[] } {
  return { version: PLATFORM_AGENT_CONFIG_VERSION, paths: allowedOverridePaths(body) }
}

/**
 * The override paths known to be in force at the provider for this agent,
 * from its agent_provider_resources.details. Unknown or stale → only the
 * first message, which every agent synced by this platform has allowed.
 */
export function overridesInForce(details: unknown): Set<string> {
  const d = details && typeof details === 'object' ? (details as Record<string, unknown>) : {}
  const co = d.client_overrides as { version?: unknown; paths?: unknown } | undefined
  if (co && typeof co.version === 'number' && co.version === d.platform_version && Array.isArray(co.paths)) {
    return new Set(co.paths.filter((p): p is string => typeof p === 'string'))
  }
  return new Set([OVERRIDE_FIRST_MESSAGE])
}
