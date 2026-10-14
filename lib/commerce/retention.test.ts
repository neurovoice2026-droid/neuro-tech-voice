import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { CONN_A, ORG_A, asClient, commerceDb } from '@/tests/helpers/commerce'
import { runCommerceRetention } from './retention'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
const DAY = 24 * 3_600_000
const NOW = Date.parse('2026-10-13T08:00:00Z')
const ago = (days: number) => new Date(NOW - days * DAY).toISOString()

function event(over: Record<string, unknown>) {
  return { org_id: ORG_A, connection_id: CONN_A, platform: 'woocommerce', topic: 'order.created', verified: true, attempts: 0, max_attempts: 5, run_after: ago(12), payload: { id: 1 }, ...over }
}

describe('commerce retention', () => {
  it('clears the payload of settled deliveries only: a delivery still queued keeps its body until it is processed', async () => {
    const db = commerceDb({
      commerce_webhook_events: [
        event({ id: 'queued-old', status: 'received', received_at: ago(12) }),
        event({ id: 'processing-old', status: 'processing', received_at: ago(12), lease_owner: 'w', lease_until: ago(11) }),
        event({ id: 'failed-old', status: 'failed', received_at: ago(12) }),
        event({ id: 'failed-recent', status: 'failed', received_at: ago(2) }),
        event({ id: 'processed-ancient', status: 'processed', payload: null, received_at: ago(100) }),
      ],
    })
    const out = await runCommerceRetention(asClient(db), log, NOW)
    expect(out.webhook_payloads).toBe(1)
    expect(out.webhook_events).toBe(1)
    const byId = Object.fromEntries(db.tables.commerce_webhook_events.map((e) => [String(e.id), e]))
    expect(byId['queued-old']).toMatchObject({ status: 'received', payload: { id: 1 } })
    expect(byId['processing-old']).toMatchObject({ status: 'processing', payload: { id: 1 } })
    expect(byId['failed-old'].payload).toBeNull()
    expect(byId['failed-recent'].payload).toEqual({ id: 1 })
    expect(byId['processed-ancient']).toBeUndefined()
    // Idempotent.
    expect((await runCommerceRetention(asClient(db), log, NOW)).webhook_payloads).toBe(0)
  })
})
