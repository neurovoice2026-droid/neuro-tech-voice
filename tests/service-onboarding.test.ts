// The service onboarding's client after a reload or a return from a cancelled
// Checkout: its store lives in the page only, so it starts at its defaults
// although steps 1-3 saved the agent on the server. The wrapper reads the
// saved agent into the store before the later steps show, and the launch
// request never carries agent fields (the route test holds the server side).

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

// next/font only exists under Next's compiler (the launch step's plan cards declare it).
vi.mock('@/components/pricing/fonts', () => ({ planTierDisplay: { variable: 'font-plan-tier-test' } }))

import { useOnboardingStore, wizardStateFromAgent, type SavedOnboardingAgent } from '@/store/useOnboardingStore'
import { launchRequestBody } from '@/components/onboarding/steps/Step5Launch'
import { OnboardingWrapper, fetchSavedAgent, needsSavedAgent } from '@/components/onboarding/OnboardingWrapper'
import { ApiError } from '@/hooks/useVoiceCatalog'
import type { Organization } from '@/types'

/** The org's agent as GET /api/agent returns it after steps 1-3 (a few of the row's other columns included). */
const saved: SavedOnboardingAgent & Record<string, unknown> = {
  id: 'a1',
  org_id: 'o1',
  name: 'Ana',
  language: 'ro',
  system_prompt: 'Ești recepționera clinicii.',
  first_message: 'Bună ziua!',
  metadata: { personality: 'friendly', behavior_settings: { x: 1 } },
  voice_id: 'voice_abc12345',
  voice_name: 'Ioana',
  is_active: false,
}

/** A reload: the page's store starts again from its defaults. */
function reload() {
  useOnboardingStore.getState().reset()
}

afterEach(() => {
  reload()
})

describe('wizardStateFromAgent', () => {
  it('takes the saved name, language, prompt, greeting, personality and voice', () => {
    expect(wizardStateFromAgent(saved)).toEqual({
      agent: { name: 'Ana', language: 'ro', system_prompt: 'Ești recepționera clinicii.', first_message: 'Bună ziua!', personality: 'friendly' },
      voice: { voice_id: 'voice_abc12345', voice_name: 'Ioana', preview_url: '' },
    })
  })

  it('reads leniently: empty columns become the form’s empty text, an unknown personality the default, no voice no voice', () => {
    const state = wizardStateFromAgent({
      name: 'Ana',
      language: null,
      system_prompt: null,
      first_message: null,
      metadata: { personality: 'sarcastic' },
      voice_id: null,
      voice_name: 'Stale name',
    })
    expect(state.agent).toEqual({ name: 'Ana', language: 'en', system_prompt: '', first_message: '', personality: 'professional' })
    expect(state.voice).toEqual({ voice_id: '', voice_name: '', preview_url: '' })
    expect(wizardStateFromAgent({ ...saved, metadata: null }).agent.personality).toBe('professional')
  })
})

describe('after a reload or a cancelled Checkout', () => {
  it('only reads the saved agent once step 2 has saved one (the server step is 3 or 4)', () => {
    expect([1, 2, 3, 4].map(needsSavedAgent)).toEqual([false, false, true, true])
  })

  it('the store at its defaults would launch an unnamed English agent: the launch request sends no agent at all', () => {
    reload()
    const s = useOnboardingStore.getState()
    expect(s.agent).toMatchObject({ name: '', language: 'en', system_prompt: '', first_message: '' })
    const body = launchRequestBody(s.plan, false, s.company)
    expect(body).not.toHaveProperty('agent')
    expect(body).toEqual({ plan: 'starter', annual: false, company: { name: '', industry: '', website: '', description: '' } })
  })

  it('the wrapper reads the saved agent into the store, so the summary and the steps show it, and the launch still sends no agent', async () => {
    reload()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(saved), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    useOnboardingStore.getState().loadAgent(await fetchSavedAgent())

    expect(fetchMock).toHaveBeenCalledWith('/api/agent', expect.objectContaining({ headers: { Accept: 'application/json' } }))
    const s = useOnboardingStore.getState()
    expect(s.agent).toEqual({ name: 'Ana', language: 'ro', system_prompt: 'Ești recepționera clinicii.', first_message: 'Bună ziua!', personality: 'friendly' })
    expect(s.voice).toEqual({ voice_id: 'voice_abc12345', voice_name: 'Ioana', preview_url: '' })
    // Loading the agent leaves the rest of the wizard as it was.
    expect(s.currentStep).toBe(1)
    expect(s.plan).toBe('starter')

    const body = launchRequestBody('pro', true, { name: 'Acme', industry: 'healthcare', website: 'https://acme.example', description: 'A clinic.' })
    expect(body).toEqual({
      plan: 'pro',
      annual: true,
      company: { name: 'Acme', industry: 'healthcare', website: 'https://acme.example', description: 'A clinic.' },
    })
  })

  it('a failed read is an error with the server’s message (the wrapper shows it with a retry, never the defaults)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Your session has expired.' }), { status: 401 })))
    await expect(fetchSavedAgent()).rejects.toEqual(expect.objectContaining({ message: 'Your session has expired.', status: 401 }))

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const err = await fetchSavedAgent().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe('Your saved agent could not be loaded.')
  })

  it('the wrapper shows no step before the saved agent is read (steps 1 and 2 have none to wait for)', () => {
    const org = { id: 'o1', name: 'Acme', industry: 'healthcare', website: null, description: 'A clinic.' } as unknown as Organization
    // The first render, before any effect: what the page shows while GET /api/agent is on its way.
    const render = (initialStep: number) => renderToString(createElement(OnboardingWrapper, { initialStep, organization: org }))

    for (const step of [3, 4]) {
      const html = render(step)
      expect(html).toContain('Loading your setup…')
      expect(html).toContain('role="status"')
      // No step at all (each one has an h1), so neither the launch nor the agent form can show the store's defaults.
      expect(html).not.toContain('<h1')
      expect(html).not.toContain('Launch my AI agent')
    }
    for (const step of [1, 2]) {
      const html = render(step)
      expect(html).not.toContain('Loading your setup…')
      expect(html).toContain('<h1')
    }
  })

  it('passes the abort signal, so an unmounted wrapper or a retry drops the earlier read', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(saved), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const ctrl = new AbortController()
    await fetchSavedAgent(ctrl.signal)
    expect(fetchMock).toHaveBeenCalledWith('/api/agent', expect.objectContaining({ signal: ctrl.signal }))
  })
})
