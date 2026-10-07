import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { maintenanceBudgetMs } from './maintenance'

afterEach(() => vi.unstubAllEnvs())

describe('maintenanceBudgetMs', () => {
  it('defaults to 240 s, below the route maxDuration', () => {
    vi.stubEnv('VOICE_MAINTENANCE_BUDGET_MS', '')
    expect(maintenanceBudgetMs()).toBe(240_000)
  })

  it('accepts values between 30 s and 270 s', () => {
    vi.stubEnv('VOICE_MAINTENANCE_BUDGET_MS', '120000')
    expect(maintenanceBudgetMs()).toBe(120_000)
  })

  it('ignores values outside the safe range', () => {
    vi.stubEnv('VOICE_MAINTENANCE_BUDGET_MS', '600000')
    expect(maintenanceBudgetMs()).toBe(240_000)
    vi.stubEnv('VOICE_MAINTENANCE_BUDGET_MS', 'abc')
    expect(maintenanceBudgetMs()).toBe(240_000)
  })
})
