import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))
const adapterState = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('../adapters', () => ({ adapterFor: () => adapterState.adapter, isCommercePlatform: (v: string) => ['woocommerce', 'shopify', 'magento', 'prestashop', 'custom'].includes(v) }))

import { CONN_A, ORG_A, PUBLIC_ID_A, asClient, commerceDb, connectionRow, fakeAdapter, normalizedOrder, orgRow } from '@/tests/helpers/commerce'
import { claimWebhookEvents, dedupeKeyFor, ingestWebhook, processWebhookEvent } from './ingest'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
const body = (o: unknown) => new TextEncoder().encode(JSON.stringify(o))
const req = (raw: Uint8Array, headers: Record<string, string> = {}) => ({ headers: new Headers(headers), rawBody: raw, url: new URL('https://app.example.com/api/commerce/webhooks/woocommerce/x') })

let n = 0
beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://app.example.com')
  n++
})

describe('webhook ingestion', () => {
  it('rejects unknown endpoints and bad signatures without writing anything', async () => {
    adapterState.adapter = fakeAdapter()
    const db = commerceDb({ commerce_connections: [connectionRow({ webhook_public_id: `${PUBLIC_ID_A}${n}` })] })
    expect((await ingestWebhook(asClient(db), { platform: 'woocommerce', publicId: 'nope-nope-nope-nope-nope', request: req(body({})) }, log)).status).toBe(404)
    expect((await ingestWebhook(asClient(db), { platform: 'magento', publicId: `${PUBLIC_ID_A}${n}`, request: req(body({})) }, log)).status).toBe(404)
    const bad = await ingestWebhook(asClient(db), { platform: 'woocommerce', publicId: `${PUBLIC_ID_A}${n}`, request: req(body({ id: 1 })) }, log)
    expect(bad.status).toBe(401)
    expect(db.tables.commerce_webhook_events ?? []).toHaveLength(0)
  })

  it('stores one idempotency row per delivery and acknowledges duplicates without a second row', async () => {
    adapterState.adapter = fakeAdapter({ verify: (raw) => ({ ok: true, topic: 'order.created', deliveryId: 'd-1', externalResourceId: '1001', payload: JSON.parse(new TextDecoder().decode(raw)) }) })
    const db = commerceDb({ commerce_connections: [connectionRow({ webhook_public_id: `${PUBLIC_ID_A}${n}` })] })
    const raw = body({ id: 1001 })
    const first = await ingestWebhook(asClient(db), { platform: 'woocommerce', publicId: `${PUBLIC_ID_A}${n}`, request: req(raw) }, log)
    expect(first).toEqual({ status: 200, body: { ok: true, accepted: true } })
    const second = await ingestWebhook(asClient(db), { platform: 'woocommerce', publicId: `${PUBLIC_ID_A}${n}`, request: req(raw) }, log)
    expect(second).toEqual({ status: 200, body: { ok: true, accepted: false, duplicate: true } })
    expect(db.tables.commerce_webhook_events).toHaveLength(1)
    expect(db.tables.commerce_webhook_events[0]).toMatchObject({ org_id: ORG_A, connection_id: CONN_A, verified: true, status: 'received', topic: 'order.created' })
    // A different body with the same delivery id is a different delivery (ids repeat within a second on some platforms).
    const third = await ingestWebhook(asClient(db), { platform: 'woocommerce', publicId: `${PUBLIC_ID_A}${n}`, request: req(body({ id: 1001, status: 'processing' })) }, log)
    expect(third.body).toMatchObject({ accepted: true })
    expect(dedupeKeyFor('d-1', raw, 'order.created')).not.toBe(dedupeKeyFor('d-1', body({ id: 2 }), 'order.created'))
    expect(dedupeKeyFor(null, raw, 'order.created')).toMatch(/^order\.created:body:[0-9a-f]{64}$/)
  })

  it('processes a claimed event exactly once: mirrors written, payload cleared, runs scheduled', async () => {
    adapterState.adapter = fakeAdapter({
      verify: (raw) => ({ ok: true, topic: 'order.created', deliveryId: null, externalResourceId: '1001', payload: JSON.parse(new TextDecoder().decode(raw)) }),
      normalize: () => [{ kind: 'order.created', order: normalizedOrder() }],
    })
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow({ webhook_public_id: `${PUBLIC_ID_A}${n}` })], commerce_automations: [{ id: 'auto-1', org_id: ORG_A, connection_id: CONN_A, agent_id: null, type: 'cod_confirmation', enabled: true, enabled_at: '2026-10-01T00:00:00Z', config: {}, script: {}, consent_confirmed_at: '2026-10-01T00:00:00Z', consent_confirmed_by: null, consent_version: 'v', created_at: 'x', updated_at: 'x' }] })
    await ingestWebhook(asClient(db), { platform: 'woocommerce', publicId: `${PUBLIC_ID_A}${n}`, request: req(body({ id: 1001 })) }, log)
    const claimed = await claimWebhookEvents(asClient(db), 'w1', 10)
    expect(claimed).toHaveLength(1)
    expect(await claimWebhookEvents(asClient(db), 'w2', 10)).toHaveLength(0)
    expect(await processWebhookEvent(asClient(db), claimed[0], 'w1', log)).toBe('processed')
    expect(db.tables.commerce_webhook_events[0]).toMatchObject({ status: 'processed', payload: null, lease_owner: null })
    expect(db.tables.commerce_orders).toHaveLength(1)
    expect(db.tables.commerce_automation_runs).toHaveLength(1)
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'scheduled', automation_type: 'cod_confirmation', to_phone_e164: '+40722123456', external_ref: '1001' })
  })
})
