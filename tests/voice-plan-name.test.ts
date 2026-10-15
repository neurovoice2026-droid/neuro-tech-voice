// The custom-voice hint names the required plan by its display name
// (components/voice/useVoiceStatus.ts), never a formatted id.

import { describe, expect, it } from 'vitest'
import { planName } from '@/components/voice/useVoiceStatus'

describe('planName', () => {
  it('shows the PLANS display name for service and store plans', () => {
    expect(planName('pro')).toBe('Pro')
    expect(planName('store_growth')).toBe('Store Growth')
    expect(planName('store_enterprise')).toBe('Store Enterprise')
  })

  it('shows an id the client does not know as sent', () => {
    expect(planName('platinum')).toBe('platinum')
  })
})
