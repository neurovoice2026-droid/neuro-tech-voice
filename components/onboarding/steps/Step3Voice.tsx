'use client'

import { useEffect, useMemo } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Mic2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { AudioPreviewButton } from '@/components/voice/AudioPreviewButton'
import { defaultVoiceFor, recommendedVoiceIds } from '@/components/voice/default-voices'
import { voicePreviewLoader } from '@/components/voice/preview-player'
import { languageLabel } from '@/components/voice/voice-options'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import type { Voice } from '@/types'

function previewPath(voiceId: string): string {
  return `/api/voices/${encodeURIComponent(voiceId)}/preview`
}

export function Step3Voice() {
  const agentLanguage = useOnboardingStore((s) => s.agent.language)
  const voice = useOnboardingStore((s) => s.voice)
  const setVoice = useOnboardingStore((s) => s.setVoice)
  const setStep = useOnboardingStore((s) => s.setStep)

  const language = normalizeAgentLanguage(agentLanguage)
  const recommendedIds = useMemo(() => recommendedVoiceIds(language), [language])

  // Start from our recommended voice for the agent's language, so Continue
  // works right away; the owner can pick any other voice below.
  useEffect(() => {
    if (voice.cartesia_voice_id) return
    const fallback = defaultVoiceFor(language)
    setVoice({
      cartesia_voice_id: fallback.id,
      cartesia_voice_name: fallback.name,
      preview_url: fallback.preview_url,
      gender: fallback.gender,
    })
  }, [language, voice.cartesia_voice_id, setVoice])

  function handleSelect(selected: Voice) {
    setVoice({
      cartesia_voice_id: selected.id,
      cartesia_voice_name: selected.name,
      preview_url: selected.preview_url,
      gender: selected.gender,
    })
  }

  const hasVoice = voice.cartesia_voice_id.length > 0

  return (
    <div className="space-y-6">
      <StepHeader
        icon={Mic2}
        title="Choose your agent’s voice"
        description={`Listen to a few voices and pick the one callers will hear. We start with native ${languageLabel(language)} speakers; change the filters to see more.`}
      />

      <VoicePicker
        value={voice.cartesia_voice_id || null}
        onChange={handleSelect}
        defaultLanguage={language}
        recommendedIds={recommendedIds}
      />

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5" aria-live="polite">
            {hasVoice ? (
              <>
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="min-w-0 truncate text-sm">
                  <span className="text-muted-foreground">Selected: </span>
                  <span className="font-semibold text-foreground">{voice.cartesia_voice_name}</span>
                </p>
                <AudioPreviewButton
                  previewKey={`voice:${voice.cartesia_voice_id}`}
                  load={voicePreviewLoader(voice.preview_url ?? previewPath(voice.cartesia_voice_id))}
                  label={voice.cartesia_voice_name}
                  variant="ghost"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a voice to continue</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={() => setStep(2)} className="h-10 gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </Button>
            <Button type="button" onClick={() => setStep(4)} disabled={!hasVoice} className="purple-glow h-10 px-6">
              Continue <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
