'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mic2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FlagIcon } from '@/components/shared/FlagIcon'
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
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Mic2 className="h-7 w-7 text-purple-600" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Choose your agent&apos;s voice</h2>
          <p className="mt-1 text-muted-foreground">
            Browse thousands of natural-sounding voices, preview them and pick the perfect one.
          </p>
        </div>
      </div>

      <VoicePicker
        layout="onboarding"
        defaultLanguage={agentLanguage}
        selectedVoiceId={selectedVoiceId}
        onSelect={setSelected}
        disabled={busy}
      />

      {/* Sticky footer: selection + navigation */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {selectedVoiceId ? (
            <div className="flex min-w-0 items-center gap-2.5" aria-live="polite">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{selectedName || 'Selected voice'}</p>
                {selectedLocale && (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {selectedLocale.country && <FlagIcon country={selectedLocale.country} className="h-3 w-4.5" />}
                    <span className="truncate">{selectedLocale.text}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a voice to continue</p>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)} disabled={busy} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
              <span className="sr-only sm:hidden">Back</span>
            </Button>
            <Button onClick={handleContinue} disabled={!selectedVoiceId || busy} className="purple-glow px-5">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {phase === 'adding' ? 'Adding voice…' : 'Saving…'}
                </>
              ) : (
                <>
                  Continue <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
