import { describe, expect, it } from 'vitest'
import { commerceStepOf, isLegacyBusinessType, onboardingVariant } from './business-type'

describe('onboardingVariant', () => {
  it('sends a legacy organization (backfilled, never chose) through the unchanged service onboarding', () => {
    expect(onboardingVariant({ business_type: 'services', business_type_selected_at: null })).toBe('services')
    expect(isLegacyBusinessType({ business_type: 'services', business_type_selected_at: null })).toBe(true)
  })
  it('treats a row without the column (migration 024 not applied) as services', () => {
    expect(onboardingVariant({})).toBe('services')
    expect(onboardingVariant(null)).toBe('services')
  })
  it('makes a new organization choose, then follows the choice', () => {
    expect(onboardingVariant({ business_type: null, business_type_selected_at: null })).toBe('choose')
    expect(onboardingVariant({ business_type: 'ecommerce', business_type_selected_at: '2026-10-13T00:00:00Z' })).toBe('ecommerce')
    expect(onboardingVariant({ business_type: 'services', business_type_selected_at: '2026-10-13T00:00:00Z' })).toBe('services')
    expect(isLegacyBusinessType({ business_type: 'services', business_type_selected_at: '2026-10-13T00:00:00Z' })).toBe(false)
  })
  it('clamps the stored step to the store flow', () => {
    expect(commerceStepOf(undefined)).toBe(1)
    expect(commerceStepOf(0)).toBe(1)
    expect(commerceStepOf(4)).toBe(4)
    expect(commerceStepOf(99)).toBe(6)
  })
})
