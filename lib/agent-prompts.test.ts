import { describe, expect, it } from 'vitest'
import { INDUSTRY_OPTIONS, SITE_TRADE_INDUSTRY, buildIndustrySystemPrompt, industryFromTrade } from './agent-prompts'
import { INDUSTRIES, NAV_INDUSTRIES } from './site'

describe('INDUSTRY_OPTIONS', () => {
  it('offers 18 unique industries, other last', () => {
    const values = INDUSTRY_OPTIONS.map((o) => o.value)
    expect(values).toHaveLength(18)
    expect(new Set(values).size).toBe(18)
    expect(values.at(-1)).toBe('other')
    for (const option of INDUSTRY_OPTIONS) expect(option.label.trim()).not.toBe('')
  })

  it('has a full template for every industry: responsibilities, boundaries and tone', () => {
    for (const { value } of INDUSTRY_OPTIONS) {
      const prompt = buildIndustrySystemPrompt({ name: 'Acme', industry: value })
      expect(prompt, value).toContain('Acme')
      expect(prompt, value).toContain('Your responsibilities:')
      expect(prompt, value).toContain('Boundaries:')
      expect(prompt, value).toMatch(/\nTone: /)
      expect(prompt, value).not.toContain('undefined')
      // Every industry except the generic one has its own template.
      if (value !== 'other') expect(prompt, value).not.toBe(buildIndustrySystemPrompt({ name: 'Acme', industry: 'other' }))
    }
  })

  it('adds the owner’s description as context', () => {
    expect(buildIndustrySystemPrompt({ name: 'Acme', industry: 'fitness', description: 'Spin studio in Cluj.' })).toContain('"Spin studio in Cluj."')
    expect(buildIndustrySystemPrompt({ name: ' ', industry: 'fitness' })).toContain('our company')
  })
})

describe('industryFromTrade', () => {
  it('maps every trade id and slug the site uses to an industry with its own template', () => {
    const siteKeys = [...INDUSTRIES.map((i) => i.id), ...NAV_INDUSTRIES.map((i) => i.slug)]
    for (const key of siteKeys) {
      expect(Object.prototype.hasOwnProperty.call(SITE_TRADE_INDUSTRY, key), key).toBe(true)
    }
    expect(industryFromTrade('clinics')).toBe('healthcare')
    expect(industryFromTrade('law')).toBe('legal')
    expect(industryFromTrade('financial-services')).toBe('finance')
    expect(industryFromTrade('home-services')).toBe('home_services')
    expect(industryFromTrade('salons-spas')).toBe('salons')
  })

  it('accepts industry values and falls back to other', () => {
    expect(industryFromTrade('property_management')).toBe('property_management')
    expect(industryFromTrade(' Veterinary ')).toBe('veterinary')
    expect(industryFromTrade('astrology')).toBe('other')
    expect(industryFromTrade(null)).toBe('other')
    expect(buildIndustrySystemPrompt({ name: 'Acme', industry: 'law-firms' })).toContain('intake assistant for Acme')
  })
})
