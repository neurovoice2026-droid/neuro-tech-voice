// The onboarding top bar's step list (components/onboarding/OnboardingTopBar.tsx
// and StepIndicator.tsx) sits absolutely centred in a 56 px bar. Its labels
// never wrap, the list keeps its own width, and the store flow's six steps
// use one short word each and, below xl, only the current step's label, so
// the row fits beside the logo and Exit at laptop widths.

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/actions', () => ({ signOut: vi.fn() }))

import { OnboardingTopBar } from '@/components/onboarding/OnboardingTopBar'
import { StepIndicator } from '@/components/onboarding/StepIndicator'
import { COMMERCE_ONBOARDING_STEPS } from '@/lib/commerce/business-type'

const render = (element: Parameters<typeof renderToString>[0]) => renderToString(element).replaceAll('<!-- -->', '')

/** The step list's labels, as [class, text] pairs (step numbers and "(done)" markers left out). */
function labels(html: string): Array<[string, string]> {
  const list = html.slice(html.indexOf('<ol'), html.indexOf('</ol>'))
  return [...list.matchAll(/<span(?: class="([^"]*)")?>([^<]+)<\/span>/g)]
    .map((m): [string, string] => [m[1] ?? '', m[2]])
    .filter(([cls]) => cls !== 'tabular-nums' && cls !== 'sr-only')
}

describe('StepIndicator', () => {
  it('keeps every label on one line and the list at its own width', () => {
    const html = render(createElement(StepIndicator, { currentStep: 2 }))
    expect(html).toContain('class="flex w-max items-center gap-1"')
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(4)
  })

  it('shows every label when not compact', () => {
    const html = render(createElement(StepIndicator, { currentStep: 2 }))
    expect(labels(html)).toEqual([['', 'Company'], ['', 'Agent'], ['', 'Voice'], ['', 'Launch']])
  })

  it('compact: below xl only the current step shows its label, the others keep it for screen readers', () => {
    const steps = [1, 2, 3, 4, 5, 6].map((num) => ({ num, label: `Step${num}` }))
    const html = render(createElement(StepIndicator, { currentStep: 3, steps, compact: true }))
    expect(labels(html)).toEqual([
      ['sr-only xl:not-sr-only', 'Step1'],
      ['sr-only xl:not-sr-only', 'Step2'],
      ['', 'Step3'],
      ['sr-only xl:not-sr-only', 'Step4'],
      ['sr-only xl:not-sr-only', 'Step5'],
      ['sr-only xl:not-sr-only', 'Step6'],
    ])
    // Done steps still say so to screen readers.
    expect(html.match(/\(done\)/g)).toHaveLength(2)
  })
})

describe('OnboardingTopBar', () => {
  it('store flow: six short labels in compact mode; the step headers keep the long ones', () => {
    const html = render(createElement(OnboardingTopBar, { variant: 'ecommerce' }))
    expect(labels(html).map(([, text]) => text)).toEqual(['Store', 'Platform', 'Sync', 'Automations', 'Agent', 'Launch'])
    expect(html.match(/xl:not-sr-only/g)).toHaveLength(5)
    expect(html).not.toContain('Connect your store')
    expect(COMMERCE_ONBOARDING_STEPS[1].label).toBe('Connect your store')
    // Phones keep the counter line instead of the list.
    expect(html).toContain('Step 1 of 6')
  })

  it('service flow: the four labels as before, never compact', () => {
    const html = render(createElement(OnboardingTopBar, { variant: 'services' }))
    expect(labels(html).map(([, text]) => text)).toEqual(['Company', 'Agent', 'Voice', 'Launch'])
    expect(html).not.toContain('xl:not-sr-only')
    expect(html).toContain('Step 1 of 4')
  })
})
