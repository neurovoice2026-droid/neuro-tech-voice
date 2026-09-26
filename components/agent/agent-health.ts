// Plain-language status of an agent's provider sync, shared by the agent page
// chip, the dashboard header and the agent status card. Only reports what
// agents.provider_sync actually says.

import type { Agent, ProviderSyncEntry, ProviderSyncState } from '@/types'

export type SyncHealthState = 'live' | 'syncing' | 'attention' | 'unsynced' | 'unavailable'

export interface SyncHealth {
  state: SyncHealthState
  /** Short chip text. */
  label: string
  /** One sentence for owners. */
  detail: string
  errors: { provider: 'cartesia' | 'elevenlabs'; name: string; message: string }[]
}

const PROVIDER_NAMES = {
  cartesia: 'Cartesia',
  elevenlabs: 'the backup voice',
} as const

function active(entry: ProviderSyncEntry | undefined): entry is ProviderSyncEntry {
  return Boolean(entry) && entry?.status !== 'disabled'
}

export function describeSyncHealth(sync: ProviderSyncState | null | undefined): SyncHealth {
  const cartesia = sync?.cartesia
  const elevenlabs = sync?.elevenlabs
  const entries = (['cartesia', 'elevenlabs'] as const)
    .map((provider) => ({ provider, entry: sync?.[provider] }))
    .filter((e): e is { provider: 'cartesia' | 'elevenlabs'; entry: ProviderSyncEntry } => active(e.entry))

  const errors = entries
    .filter((e) => e.entry.status === 'error')
    .map((e) => ({
      provider: e.provider,
      name: PROVIDER_NAMES[e.provider],
      message: e.entry.error?.trim() || 'The update didn’t go through.',
    }))

  if (errors.length > 0) {
    const first = errors[0]
    return {
      state: 'attention',
      label: 'Needs attention',
      detail: `We couldn’t update ${first.name}: ${first.message}`,
      errors,
    }
  }

  if (entries.some((e) => e.entry.status === 'pending')) {
    return {
      state: 'syncing',
      label: 'Syncing…',
      detail: 'Sending your latest settings to the voice providers. This usually takes a few seconds.',
      errors: [],
    }
  }

  const recorded = [cartesia, elevenlabs].filter((e): e is ProviderSyncEntry => Boolean(e))
  if (recorded.length > 0 && recorded.every((e) => e.status === 'disabled')) {
    // The sync ran but no voice provider is configured on the server: nothing the owner can retry.
    return {
      state: 'unavailable',
      label: 'Voice service offline',
      detail: 'Our voice providers aren’t connected yet, so your agent can’t answer calls. Please contact support.',
      errors: [],
    }
  }

  if (entries.length === 0) {
    return {
      state: 'unsynced',
      label: 'Not synced yet',
      detail: 'Your settings are saved but haven’t been sent to the voice providers yet.',
      errors: [],
    }
  }

  const cartesiaLive = cartesia?.status === 'synced'
  const backupLive = elevenlabs?.status === 'synced'
  return {
    state: 'live',
    label: cartesiaLive ? 'Live on Cartesia' : 'Live',
    detail: cartesiaLive
      ? backupLive
        ? 'Your latest settings are live, and the backup voice is ready if it’s ever needed.'
        : 'Your latest settings are live.'
      : 'Your latest settings are live on the backup voice.',
    errors: [],
  }
}

export interface AgentStatusSummary {
  answering: boolean
  statusLabel: string
  statusDetail: string
  sync: SyncHealth
}

/** Whether the agent answers calls, plus how its provider copies are doing. */
export function describeAgentStatus(agent: Pick<Agent, 'is_active' | 'provider_sync'>): AgentStatusSummary {
  const sync = describeSyncHealth(agent.provider_sync)
  if (!agent.is_active) {
    return {
      answering: false,
      statusLabel: 'Paused',
      statusDetail: 'Your agent isn’t answering calls. Turn it on when you’re ready.',
      sync,
    }
  }
  return {
    answering: true,
    statusLabel: 'Answering calls',
    statusDetail: sync.detail,
    sync,
  }
}
