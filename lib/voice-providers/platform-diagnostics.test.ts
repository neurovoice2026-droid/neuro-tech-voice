import { describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

import { agentStateProblems, platformEnvProblems } from './platform-diagnostics'
import { PLATFORM_AGENT_CONFIG_VERSION } from '@/lib/elevenlabs/agent-config'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ component: 'test' })

describe('platformEnvProblems', () => {
  it('is quiet with defaults', () => {
    expect(platformEnvProblems({})).toEqual([])
  })

  it('flags disabled agent auth (error in production), invalid values and switched-off safety', () => {
    const problems = platformEnvProblems({
      NODE_ENV: 'production',
      ELEVENLABS_AGENT_AUTH: 'false',
      ELEVENLABS_CONCURRENCY_PRO: 'many',
      ELEVENLABS_CONTENT_GUARDRAILS: 'violence,nonsense',
      ELEVENLABS_ENABLE_GUARDRAILS: 'false',
      ELEVENLABS_TRUST_CONTEXT: 'high',
      ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS: '30',
      ELEVENLABS_ROLLOUT_BATCH: '0',
    })
    const byKey = Object.fromEntries(problems.map((p) => [p.key, p]))
    expect(byKey.ELEVENLABS_AGENT_AUTH.severity).toBe('error')
    expect(byKey.ELEVENLABS_CONCURRENCY_PRO).toBeTruthy()
    expect(byKey.ELEVENLABS_CONTENT_GUARDRAILS.message).toContain('nonsense')
    expect(byKey.ELEVENLABS_ENABLE_GUARDRAILS).toBeTruthy()
    expect(byKey.ELEVENLABS_TRUST_CONTEXT).toBeTruthy()
    expect(byKey.ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS).toBeTruthy()
    expect(byKey.ELEVENLABS_ROLLOUT_BATCH.message).toContain('off')
    expect(platformEnvProblems({ ELEVENLABS_AGENT_AUTH: 'false' })[0].severity).toBe('warning')
  })
})

describe('agentStateProblems', () => {
  it('counts read-back flags and agents waiting for the rollout (counts only, no identifiers)', async () => {
    const db = memoryDb({
      agent_provider_resources: [
        { provider: 'elevenlabs', status: 'ready', org_id: 'org-secret-1', details: { platform_version: PLATFORM_AGENT_CONFIG_VERSION } },
        { provider: 'elevenlabs', status: 'ready', org_id: 'org-secret-2', details: { platform_version: PLATFORM_AGENT_CONFIG_VERSION, analysis_items_migrated: true, stale_keys: { data_collection: ['x'] }, pii_redaction: 'rejected', paused: true } },
        { provider: 'elevenlabs', status: 'ready', org_id: 'org-secret-3', details: {} },
        { provider: 'cartesia', status: 'ready', details: { analysis_items_migrated: true } },
      ],
    })
    const { problems, counts } = await agentStateProblems(db as never, log)
    expect(counts).toEqual({ agents: 3, analysis_items_migrated: 1, stale_keys: 1, pii_redaction_rejected: 1, outdated_platform_config: 1, paused: 1 })
    expect(problems.find((p) => p.key === 'agent_sync.analysis_items')?.severity).toBe('error')
    expect(problems.map((p) => p.key)).toEqual(['agent_sync.analysis_items', 'agent_sync.stale_keys', 'ELEVENLABS_PII_REDACTION', 'config_rollout'])
    expect(JSON.stringify(problems)).not.toContain('org-secret')
  })

  it('degrades to a warning when the table cannot be read', async () => {
    const broken = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) }) }
    const { problems } = await agentStateProblems(broken as never, log)
    expect(problems).toEqual([expect.objectContaining({ key: 'agent_sync.read_back', severity: 'warning' })])
  })
})
