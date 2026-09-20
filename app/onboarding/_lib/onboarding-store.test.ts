// store/useOnboardingStore.ts lives outside the vitest include globs, so its
// actions are exercised from here. Node has no sessionStorage: the guarded
// storage falls back to memory, which is exactly the blocked-storage case.

import { beforeEach, describe, expect, it } from 'vitest'
import { useOnboardingStore } from '@/store/useOnboardingStore'

const VOICE = { cartesia_voice_id: 'voice-en', cartesia_voice_name: 'Skylar', preview_url: null, gender: 'feminine' as const }

describe('useOnboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset()
  })

  it('remembers the language a voice was picked for', () => {
    const store = useOnboardingStore.getState()
    store.setAgent({ language: 'en' })
    store.setVoice(VOICE)
    expect(useOnboardingStore.getState().voiceLanguage).toBe('en')
    expect(useOnboardingStore.getState().voice).toEqual(VOICE)
  })

  it('keeps the voice while the language is unchanged', () => {
    const store = useOnboardingStore.getState()
    store.setAgent({ language: 'en' })
    store.setVoice(VOICE)
    expect(useOnboardingStore.getState().dropVoiceForOtherLanguage()).toBe(false)
    expect(useOnboardingStore.getState().voice.cartesia_voice_id).toBe('voice-en')
  })

  it('drops a voice picked for another language', () => {
    const store = useOnboardingStore.getState()
    store.setAgent({ language: 'en' })
    store.setVoice(VOICE)
    store.setAgent({ language: 'ro' })
    expect(useOnboardingStore.getState().dropVoiceForOtherLanguage()).toBe(true)
    const after = useOnboardingStore.getState()
    expect(after.voice.cartesia_voice_id).toBe('')
    expect(after.voiceLanguage).toBeNull()
    expect(after.dropVoiceForOtherLanguage()).toBe(false)
  })

  it('clamps steps and resets to defaults', () => {
    const store = useOnboardingStore.getState()
    store.setStep(9)
    expect(useOnboardingStore.getState().currentStep).toBe(4)
    store.setStep(0)
    expect(useOnboardingStore.getState().currentStep).toBe(1)
    store.setCompany({ name: 'Acme' })
    store.reset()
    expect(useOnboardingStore.getState().company.name).toBe('')
  })
})
