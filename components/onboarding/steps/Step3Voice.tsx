'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { StatusChip } from '@/components/shared/StatusChip'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { voiceDisplayName, voiceLocaleLine } from '@/components/voice/VoiceCard'
import {
  agentVoiceBody,
  errorMessage,
  parseApiError,
  saveAgentVoice,
  type AgentVoiceBody,
} from '@/hooks/useVoiceCatalog'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import type { VoiceOption } from '@/types'
import { StepActions, StepBody, StepHeader } from '../StepIndicator'

type Phase = 'idle' | 'adding' | 'saving'

export function Step3Voice() {
  const voice = useOnboardingStore((s) => s.voice)
  const agentLanguage = useOnboardingStore((s) => s.agent.language)
  const setVoice = useOnboardingStore((s) => s.setVoice)
  const setStep = useOnboardingStore((s) => s.setStep)

  const [selected, setSelected] = useState<VoiceOption | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const busy = phase !== 'idle'

  // A voice picked earlier in this session stays selected when coming back.
  const selectedVoiceId = selected?.voiceId ?? (voice.voice_id || null)
  const selectedName = selected ? voiceDisplayName(selected) : voice.voice_name
  const selectedLocale = selected ? voiceLocaleLine(selected) : null

  async function handleContinue() {
    if (busy) return
    const body: AgentVoiceBody | null = selected
      ? agentVoiceBody(selected)
      : voice.voice_id
        ? { voice_id: voice.voice_id, voice_name: voice.voice_name }
        : null
    if (!body) return

    setPhase(selected?.requiresProvisioning ? 'adding' : 'saving')
    try {
      const result = await saveAgentVoice(body)
      // During onboarding the agent is created at launch, so "pending" is the
      // normal outcome; only an explicit failure stops the wizard.
      if (result.voice_sync_status === 'failed') {
        toast.error('Could not apply this voice', {
          description: result.error ?? result.agent.voice_sync_error ?? 'Please try again or pick another voice.',
        })
        return
      }
      setVoice({
        voice_id: result.agent.voice_id ?? body.voice_id,
        voice_name: result.agent.voice_name ?? body.voice_name,
        preview_url: selected?.previewUrl ?? voice.preview_url ?? '',
      })

      setPhase('saving')
      const res = await fetch('/api/onboarding/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw await parseApiError(res, 'Could not save your progress. Please try again.')
      setStep(4)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save this voice. Please try again.'))
    } finally {
      setPhase('idle')
    }
  }

  return (
    <div>
      <StepHeader
        step={3}
        title="Choose your agent's voice"
        description="Browse thousands of natural-sounding voices, preview them and pick the perfect one."
      />

      <StepBody>
        <VoicePicker
          layout="onboarding"
          defaultLanguage={agentLanguage}
          selectedVoiceId={selectedVoiceId}
          onSelect={setSelected}
          disabled={busy}
        />
      </StepBody>

      {/* Sticky at every width: the list is long, the choice and Continue stay in reach. */}
      <StepActions sticky="always" className="justify-between">
        <div className="flex min-w-0 items-center gap-2" aria-live="polite">
          {selectedVoiceId ? (
            <>
              <StatusChip
                tone="neutral"
                icon={<CheckCircle2 className="text-success-dot" aria-hidden="true" />}
                className="max-w-full min-w-0 shrink"
              >
                <span className="truncate">
                  <span className="sr-only sm:not-sr-only">Selected: </span>
                  {selectedName || 'Selected voice'}
                </span>
              </StatusChip>
              {selectedLocale && (
                <span className="hidden min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground sm:flex">
                  {selectedLocale.country && <FlagIcon country={selectedLocale.country} className="h-3 w-[18px]" />}
                  <span className="truncate">{selectedLocale.text}</span>
                </span>
              )}
            </>
          ) : (
            <p className="text-[13px] leading-[19px] text-muted-foreground">Select a voice to continue</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setStep(2)}
            disabled={busy}
            className="max-sm:size-11 max-sm:px-0"
          >
            <ArrowLeft aria-hidden="true" />
            <span className="max-sm:sr-only">Back</span>
          </Button>
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!selectedVoiceId}
            loading={busy}
            loadingText={phase === 'adding' ? 'Adding voice…' : 'Saving…'}
          >
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </StepActions>
    </div>
  )
}
