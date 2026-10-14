'use client'

// Step 5, second part: the voice. The same picker and save path as the
// service flow's Step3Voice (VoicePicker + saveAgentVoice → PUT /api/agent/voice),
// bound to the store onboarding's agent and copy.

import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { StatusChip } from '@/components/shared/StatusChip'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { voiceDisplayName, voiceLocaleLine } from '@/components/voice/VoiceCard'
import { agentVoiceBody, errorMessage, saveAgentVoice, type AgentVoiceBody } from '@/hooks/useVoiceCatalog'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import type { VoiceOption } from '@/types'
import { StepActions, StepBody } from '../StepIndicator'

type Phase = 'idle' | 'adding' | 'saving'

interface VoiceStepProps {
  onBack: () => void
  onSaved: () => void
}

export function VoiceStep({ onBack, onSaved }: VoiceStepProps) {
  const agent = useCommerceOnboardingStore((s) => s.agent)
  const profileLanguage = useCommerceOnboardingStore((s) => s.profile.language)
  const setAgent = useCommerceOnboardingStore((s) => s.setAgent)

  const [selected, setSelected] = useState<VoiceOption | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const busy = phase !== 'idle'

  // The saved voice stays selected when coming back.
  const savedVoiceId = agent?.voice_id ?? null
  const savedVoiceName = agent?.voice_name ?? ''
  const selectedVoiceId = selected?.voiceId ?? savedVoiceId
  const selectedName = selected ? voiceDisplayName(selected) : savedVoiceName
  const selectedLocale = selected ? voiceLocaleLine(selected) : null

  async function handleContinue() {
    if (busy) return
    const body: AgentVoiceBody | null = selected
      ? agentVoiceBody(selected)
      : savedVoiceId
        ? { voice_id: savedVoiceId, voice_name: savedVoiceName }
        : null
    if (!body) return

    setPhase(selected?.requiresProvisioning ? 'adding' : 'saving')
    try {
      const result = await saveAgentVoice(body)
      // The agent is created at launch, so "pending" is the normal outcome here; only an
      // explicit failure stops the wizard.
      if (result.voice_sync_status === 'failed') {
        toast.error('The voice could not be applied', {
          description: result.error ?? result.agent.voice_sync_error ?? 'Try again or pick another voice.',
        })
        return
      }
      if (agent) {
        setAgent({
          ...agent,
          voice_id: result.agent.voice_id ?? body.voice_id,
          voice_name: result.agent.voice_name ?? body.voice_name,
        })
      }
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err, 'The voice could not be saved. Please try again.'))
    } finally {
      setPhase('idle')
    }
  }

  return (
    <>
      <StepBody>
        <VoicePicker
          layout="onboarding"
          defaultLanguage={agent?.language || profileLanguage}
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
              <StatusChip tone="neutral" icon={<CheckCircle2 className="text-success-dot" aria-hidden="true" />} className="max-w-full min-w-0 shrink">
                <span className="truncate">
                  <span className="sr-only sm:not-sr-only">Selected: </span>
                  {selectedName || 'Voice selected'}
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
            <p className="text-[13px] leading-[19px] text-muted-foreground">Pick a voice to continue</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="lg" onClick={onBack} disabled={busy} className="max-sm:size-11 max-sm:px-0">
            <ArrowLeft aria-hidden="true" />
            <span className="max-sm:sr-only">Back</span>
          </Button>
          <Button size="lg" onClick={handleContinue} disabled={!selectedVoiceId} loading={busy} loadingText={phase === 'adding' ? 'Adding the voice…' : 'Saving…'}>
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </StepActions>
    </>
  )
}
