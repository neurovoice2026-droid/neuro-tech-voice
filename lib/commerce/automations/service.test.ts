// The enable gate of PUT /api/commerce/automations/[type]: before launch the
// store onboarding saves an automation as enabled although the agent is not
// active yet and no number exists (both come at or after launch); after launch
// both are required again. Dispatch refuses to dial without them either way
// (startOutboundCall, covered in ./dispatch.test.ts).
import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { RequestError } from '@/lib/api/http'
import { AGENT_A, ORG_A, USER_A, asClient, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { upsertAutomation } from './service'
import { buildOverview } from '../overview'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }

beforeEach(() => {
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', crypto.randomBytes(32).toString('base64'))
})

function seed(org: Record<string, unknown>, opts: { agentActive?: boolean; number?: boolean } = {}) {
  return commerceDb({
    organizations: [orgRow(ORG_A, org)],
    // ensureAgent creates the onboarding's agent without is_active; the column defaults to false.
    agents: [{ id: AGENT_A, org_id: ORG_A, name: 'Maria', is_active: opts.agentActive ?? false, created_at: 'x' }],
    phone_numbers: opts.number ? [{ id: 'num-1', org_id: ORG_A, is_active: true, supports_outbound: true }] : [],
    commerce_connections: [connectionRow()],
    commerce_automations: [],
    commerce_automation_runs: [],
  })
}

const enable = (db: ReturnType<typeof seed>) =>
  upsertAutomation(
    asClient(db),
    { orgId: ORG_A, userId: USER_A, connection: connectionRow() as never, type: 'cod_confirmation', patch: { connection_id: connectionRow().id, enabled: true, consent_confirmed: true }, agentId: AGENT_A, brandName: 'Shop' },
    log as never,
  )

describe('enabling an automation', () => {
  it('succeeds during the store onboarding, before the agent is live and a number exists', async () => {
    const db = seed({ onboarding_completed: false, onboarding_step: 4 })
    const dto = await enable(db)
    expect(dto).toMatchObject({ enabled: true, consent_version: expect.any(String) })
    expect(db.tables.commerce_automations[0]).toMatchObject({ enabled: true, enabled_at: expect.any(String) })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'automation.enabled')).toBe(true)
  })

  it('still requires an active agent and a number after launch', async () => {
    const paused = enable(seed({ onboarding_completed: true }, { agentActive: false, number: true }))
    await expect(paused).rejects.toBeInstanceOf(RequestError)
    await expect(paused).rejects.toMatchObject({ status: 409, details: { reason: 'agent_inactive' } })
    await expect(enable(seed({ onboarding_completed: true }, { agentActive: true, number: false }))).rejects.toMatchObject({ status: 409, details: { reason: 'no_phone_number' } })
    await expect(enable(seed({ onboarding_completed: true }, { agentActive: true, number: true }))).resolves.toMatchObject({ enabled: true })
  })

  it('keeps every other condition before launch too (consent, a usable connection)', async () => {
    const db = seed({ onboarding_completed: false })
    const noConsent = upsertAutomation(
      asClient(db),
      { orgId: ORG_A, userId: USER_A, connection: connectionRow() as never, type: 'cod_confirmation', patch: { connection_id: connectionRow().id, enabled: true }, agentId: AGENT_A, brandName: 'Shop' },
      log as never,
    )
    await expect(noConsent).rejects.toMatchObject({ status: 409, details: { reason: 'no_consent' } })
    const disconnected = upsertAutomation(
      asClient(db),
      { orgId: ORG_A, userId: USER_A, connection: connectionRow({ status: 'disconnected' }) as never, type: 'cod_confirmation', patch: { connection_id: connectionRow().id, enabled: true, consent_confirmed: true }, agentId: AGENT_A, brandName: 'Shop' },
      log as never,
    )
    await expect(disconnected).rejects.toMatchObject({ status: 409, details: { reason: 'connection_inactive' } })
  })
})

describe('run counts', () => {
  it('counts runs waiting for a retry in the queue and the automation tiles', async () => {
    const db = seed({ onboarding_completed: true }, { agentActive: true, number: true })
    await enable(db)
    const automationId = String(db.tables.commerce_automations[0].id)
    const runs = ['scheduled', 'scheduled', 'retry_waiting', 'completed', 'cancelled'].map((status, i) => ({ id: `r${i}`, org_id: ORG_A, automation_id: automationId, connection_id: connectionRow().id, automation_type: 'cod_confirmation', external_ref: String(i), event_key: `e${i}`, idempotency_key: `k${i}`, status, created_at: `2026-10-13T0${i}:00:00Z`, updated_at: 'x' }))
    db.tables.commerce_automation_runs.push(...runs)
    const overview = await buildOverview(asClient(db), { id: ORG_A, plan: 'pro' }, 'Shop')
    expect(overview.queue).toMatchObject({ scheduled: 2, retrying: 1, completed: 1 })
    expect(overview.automations.find((a) => a.type === 'cod_confirmation')?.stats).toMatchObject({ scheduled: 2, retrying: 1, completed: 1 })
  })
})
