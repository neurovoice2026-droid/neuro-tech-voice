import { beforeEach, describe, expect, it, vi } from 'vitest'

// Wiring test for the real deletion steps: every provider and the database are
// mocked, and each mock appends to one ordered log.

const h = vi.hoisted(() => {
  const ORG = '11111111-1111-4111-8111-111111111111'
  const USER = '22222222-2222-4222-8222-222222222222'
  const state = {
    log: [] as string[],
    orgDeleteError: null as { code: string; message: string } | null,
    agentDeleteFails: false,
    tables: {} as Record<string, unknown[]>,
    storage: {} as Record<string, Record<string, { name: string; id: string | null }[]>>,
  }
  return { ORG, USER, state }
})

vi.mock('@/lib/env', () => ({
  env: { ELEVENLABS_API_KEY: 'test-key' },
  isStripeConfigured: () => true,
  isTwilioConfigured: () => true,
  isCartesiaConfigured: () => true,
  isElevenLabsConfigured: () => true,
}))

vi.mock('@/lib/api/auth', () => ({
  withAgentDefaults: (row: Record<string, unknown>) => row,
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: () => ({
    subscriptions: {
      list: async () => ({ data: [{ id: 'sub_found', status: 'active' }, { id: 'sub_old', status: 'canceled' }] }),
      cancel: async (id: string) => {
        h.state.log.push(`stripe.cancel:${id}`)
      },
    },
  }),
}))

vi.mock('@/lib/twilio/client', () => ({
  PHONE_NUMBER_SID_REGEX: /^PN[0-9a-f]{32}$/i,
  RECORDING_SID_REGEX: /^RE[0-9a-f]{32}$/i,
  getTwilioClient: () => ({
    incomingPhoneNumbers: (sid: string) => ({
      remove: async () => {
        h.state.log.push(`twilio.release:${sid}`)
      },
    }),
  }),
  isTwilioNotFound: () => false,
  twilioErrorInfo: () => ({ status: null, code: null, message: '' }),
}))

vi.mock('@/lib/twilio/calls', () => ({
  deleteRecording: async (sid: string) => {
    h.state.log.push(`twilio.recording:${sid}`)
  },
}))

vi.mock('@/lib/cartesia/client', () => {
  class CartesiaError extends Error {
    status = 500
  }
  return {
    CartesiaError,
    cartesia: {
      voices: {
        delete: async (id: string) => {
          h.state.log.push(`cartesia.voice:${id}`)
        },
      },
      knowledge: {
        deleteDocument: async (id: string) => {
          h.state.log.push(`cartesia.document:${id}`)
        },
      },
      calls: {
        delete: async (id: string) => {
          h.state.log.push(`cartesia.call:${id}`)
        },
      },
    },
  }
})

vi.mock('@/lib/voice/sync', () => ({
  deleteAgentProviders: async (agent: { id: string }) => {
    h.state.log.push(`agent.providers:${agent.id}`)
    if (h.state.agentDeleteFails) throw new Error('cartesia is not configured')
  },
}))

vi.mock('@/lib/google/client', () => ({
  revokeGoogleAccess: async (orgId: string) => {
    h.state.log.push(`google.revoke:${orgId}`)
    return { revoked: 1, failed: 0 }
  },
}))

vi.mock('@/lib/supabase/admin', () => {
  function query(table: string) {
    let op: 'select' | 'delete' = 'select'
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      delete: () => {
        op = 'delete'
        return builder
      },
      range: async () => ({ data: h.state.tables[table] ?? [], error: null }),
      maybeSingle: async () => ({ data: (h.state.tables[table] ?? [])[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => void) => {
        if (op === 'delete') {
          h.state.log.push(`db.delete:${table}`)
          resolve({ error: h.state.orgDeleteError })
        } else resolve({ data: h.state.tables[table] ?? [], error: null })
      },
    }
    return builder
  }
  const client = {
    from: query,
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string) => ({ data: h.state.storage[bucket]?.[folder] ?? [], error: null }),
        remove: async (paths: string[]) => {
          h.state.log.push(`storage.remove:${bucket}:${paths.join(',')}`)
          return { error: null }
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          h.state.log.push(`auth.deleteUser:${id}`)
          return { error: null }
        },
      },
    },
  }
  return { createAdminClient: () => client }
})

import { deleteOrganizationData, knowledgeProviderIds } from './delete'
import { AccountDeletionError } from './deletion-plan'

const PN = `PN${'a'.repeat(32)}`
const RE = `RE${'b'.repeat(32)}`

function seed() {
  h.state.log = []
  h.state.orgDeleteError = null
  h.state.agentDeleteFails = false
  h.state.tables = {
    organizations: [{ id: h.ORG, user_id: h.USER, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_plan' }],
    agents: [{ id: 'agent-1', org_id: h.ORG }],
    phone_numbers: [{ id: 'pn-1', twilio_sid: PN, elevenlabs_phone_number_id: null, stripe_subscription_id: 'sub_number' }],
    voice_clones: [{ id: 'vc-1', cartesia_voice_id: 'voice-1', elevenlabs_voice_id: null, source_storage_path: null, status: 'ready' }],
    knowledge_documents: [{ id: 'doc-1', storage_path: `${h.ORG}/agent-1/a.pdf`, extracted_text_path: null, cartesia_doc_id: 'cdoc-1', elevenlabs_doc_id: null }],
    calls: [
      { id: 'call-1', recording_sid: RE, provider_call_id: 'ac_1', voice_provider: 'cartesia', pipeline_mode: 'cartesia_managed', elevenlabs_conversation_id: null },
    ],
  }
  h.state.storage = {
    'knowledge-documents': {
      [h.ORG]: [{ name: 'agent-1', id: null }],
      [`${h.ORG}/agent-1`]: [{ name: 'a.pdf', id: 'obj-1' }],
    },
    'voice-previews': {
      [h.ORG]: [{ name: 'text', id: null }],
      [`${h.ORG}/text`]: [{ name: 'greeting.mp3', id: 'obj-2' }],
    },
    'voice-lab-uploads': {
      [h.ORG]: [{ name: 'upload.wav', id: 'obj-3' }],
    },
  }
}

function indexOf(prefix: string): number {
  const index = h.state.log.findIndex((entry) => entry.startsWith(prefix))
  expect(index, `${prefix} should have run`).toBeGreaterThanOrEqual(0)
  return index
}

describe('deleteOrganizationData', () => {
  beforeEach(() => {
    seed()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  })

  it('runs every step in order, ending with the organization and then the sign-in', async () => {
    await deleteOrganizationData(h.ORG)

    // Every subscription we know of, including one found only in Stripe; never the cancelled one.
    expect(h.state.log).toEqual(expect.arrayContaining(['stripe.cancel:sub_plan', 'stripe.cancel:sub_number', 'stripe.cancel:sub_found']))
    expect(h.state.log).not.toContain('stripe.cancel:sub_old')

    const order = [
      indexOf('stripe.cancel'),
      indexOf('twilio.release'),
      indexOf('cartesia.document'),
      indexOf('agent.providers'),
      indexOf('cartesia.voice'),
      indexOf('twilio.recording'),
      indexOf('google.revoke'),
      indexOf('storage.remove:knowledge-documents'),
      indexOf('db.delete:organizations'),
      indexOf('auth.deleteUser'),
    ]
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(h.state.log).toContain('cartesia.call:ac_1')
    expect(h.state.log).toContain(`storage.remove:knowledge-documents:${h.ORG}/agent-1/a.pdf`)
    // Nested folders and every org-scoped bucket are emptied, not just knowledge files.
    expect(h.state.log).toContain(`storage.remove:voice-previews:${h.ORG}/text/greeting.mp3`)
    expect(h.state.log).toContain(`storage.remove:voice-lab-uploads:${h.ORG}/upload.wav`)
    expect(h.state.log.at(-1)).toBe(`auth.deleteUser:${h.USER}`)
  })

  it('carries on when a provider fails', async () => {
    h.state.agentDeleteFails = true
    await deleteOrganizationData(h.ORG)
    expect(indexOf('agent.providers')).toBeLessThan(indexOf('db.delete:organizations'))
    expect(h.state.log.at(-1)).toBe(`auth.deleteUser:${h.USER}`)
  })

  it('stops before deleting the sign-in when the organization row cannot be deleted', async () => {
    h.state.orgDeleteError = { code: '42501', message: 'permission denied' }
    await expect(deleteOrganizationData(h.ORG)).rejects.toBeInstanceOf(AccountDeletionError)
    expect(h.state.log.some((entry) => entry.startsWith('auth.deleteUser'))).toBe(false)
  })
})

describe('knowledgeProviderIds', () => {
  it('lists every Cartesia part and a replaced ElevenLabs copy', () => {
    expect(
      knowledgeProviderIds({
        id: 'doc-1',
        storage_path: null,
        extracted_text_path: null,
        cartesia_doc_id: 'part-1',
        elevenlabs_doc_id: 'el-new',
        provider_sync: { cartesia: { doc_ids: ['part-1', 'part-2'] }, elevenlabs: { stale_doc_id: 'el-old' } },
      })
    ).toEqual({ cartesia: ['part-1', 'part-2'], elevenlabs: ['el-new', 'el-old'] })
    expect(knowledgeProviderIds({ id: 'd', storage_path: null, extracted_text_path: null, cartesia_doc_id: null, elevenlabs_doc_id: null })).toEqual({
      cartesia: [],
      elevenlabs: [],
    })
  })
})
