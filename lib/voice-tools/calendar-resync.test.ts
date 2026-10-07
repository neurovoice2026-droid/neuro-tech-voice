import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const sync = { bumpRevision: vi.fn(), syncAgent: vi.fn() }
vi.mock('@/lib/voice-providers/agent-sync', () => ({
  bumpRevision: (...a: unknown[]) => sync.bumpRevision(...a),
  syncAgent: (...a: unknown[]) => sync.syncAgent(...a),
}))

import { createLogger } from '@/lib/observability/logger'
import { resyncAfterCalendarChange } from './calendar-resync'

const log = createLogger({ component: 'test' })

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  sync.bumpRevision.mockReset().mockResolvedValue(5)
  sync.syncAgent.mockReset().mockResolvedValue([])
  state.db = memoryDb({
    agents: [
      { id: 'a1', org_id: 'org1', booking_settings: { enabled: true } },
      { id: 'a2', org_id: 'org2', booking_settings: { enabled: true } },
      { id: 'a3', org_id: 'org3', booking_settings: { enabled: false } },
    ],
  })
})

describe('calendar connection change → agent re-sync', () => {
  it("re-syncs only the org's own agent, and only when booking is enabled", async () => {
    expect(await resyncAfterCalendarChange('org1', log)).toBe(1)
    expect(sync.syncAgent).toHaveBeenCalledWith('a1', expect.anything())
    expect(sync.syncAgent).not.toHaveBeenCalledWith('a2', expect.anything())
    expect(await resyncAfterCalendarChange('org3', log)).toBe(0)
    expect(sync.syncAgent).toHaveBeenCalledTimes(1)
  })

  it('a failed sync is logged, never thrown', async () => {
    sync.syncAgent.mockRejectedValue(new Error('provider down'))
    await expect(resyncAfterCalendarChange('org1', log)).resolves.toBe(0)
  })
})
