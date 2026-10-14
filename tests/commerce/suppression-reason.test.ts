// The do-not-call removal dialog and DELETE /api/commerce/suppressions/[customerId]
// agree on the reason's length: a reason the dialog lets through is accepted
// by the route, and one character more is refused on both sides.
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({ supabase: null, user: { id: '66666666-6666-4666-8666-666666666666', email: null }, org: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Magazinul Exemplu', timezone: 'Europe/Bucharest', plan: 'pro' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { SUPPRESSION_REASON_MAX, SUPPRESSION_REASON_MIN, suppressionReasonOk } from '@/components/commerce/suppression-reason'
import { CONN_A, ORG_A, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { DELETE as removeSuppression } from '@/app/api/commerce/suppressions/[customerId]/route'

const CUST_A = '77777777-7777-4777-8777-777777777777'

function seed() {
  state.db = commerceDb({
    organizations: [orgRow(ORG_A)],
    commerce_connections: [connectionRow()],
    commerce_customers: [{ id: CUST_A, org_id: ORG_A, connection_id: CONN_A, external_id: 'c', name: 'Andreea Popescu', phone_e164: '+40722123456', do_not_call: true, do_not_call_source: 'operator', do_not_call_at: '2026-10-01T00:00:00Z', updated_at: 'x' }],
  })
  return state.db as ReturnType<typeof commerceDb>
}

const del = (reason: string) =>
  removeSuppression(
    new Request('https://app.example.com/api/commerce/suppressions/x', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', origin: 'https://app.example.com', host: 'app.example.com' },
      body: JSON.stringify({ confirm: true, reason }),
    }),
    { params: Promise.resolve({ customerId: CUST_A }) },
  )

describe('suppression removal reason', () => {
  it('the dialog gate matches the route bounds', () => {
    expect(suppressionReasonOk('ab')).toBe(false)
    expect(suppressionReasonOk('  abc  ')).toBe(true)
    expect(suppressionReasonOk('x'.repeat(SUPPRESSION_REASON_MAX))).toBe(true)
    expect(suppressionReasonOk('x'.repeat(SUPPRESSION_REASON_MAX + 1))).toBe(false)
    expect(SUPPRESSION_REASON_MIN).toBe(3)
  })

  it('the route accepts a reason of the maximum length and refuses one character more', async () => {
    const tooLong = 'x'.repeat(SUPPRESSION_REASON_MAX + 1)
    expect(suppressionReasonOk(tooLong)).toBe(false)
    seed()
    const refused = await del(tooLong)
    expect(refused.status).toBe(400)
    const body = await refused.json()
    expect(body.details?.[0]?.path).toBe('reason')

    const db = seed()
    const longest = 'x'.repeat(SUPPRESSION_REASON_MAX)
    expect(suppressionReasonOk(longest)).toBe(true)
    const ok = await del(longest)
    expect(ok.status).toBe(200)
    expect(db.tables.commerce_customers[0].do_not_call).toBe(false)
    expect(db.tables.commerce_audit_log?.[0]?.metadata).toMatchObject({ reason: longest })
  })
})
