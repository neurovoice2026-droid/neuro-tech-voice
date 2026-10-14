'use client'

// Step 5 — Agentul tău: the agent form, then the voice, then an optional
// browser test. The phase a reload lands on comes from what is saved: a
// prompt means the form is done, a voice means the picker is done.

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Info, Mic } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/shared/StatusChip'
import { TestAgentPanel } from '@/components/agent/TestAgentPanel'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { StepActions, StepBody } from '../../StepIndicator'
import { AgentForm } from '../AgentForm'
import { VoiceStep } from '../VoiceStep'
import { useCommerceNavigation } from '../navigation'
import { CommerceStepHeader } from '../shared'

type Phase = 'form' | 'voice' | 'test'

export function AgentStep() {
  const agent = useCommerceOnboardingStore((s) => s.agent)
  const { goTo } = useCommerceNavigation()
  const [phase, setPhase] = useState<Phase>(() => (agent?.system_prompt ? (agent.voice_id ? 'test' : 'voice') : 'form'))

  if (phase === 'form') {
    return (
      <div>
        <CommerceStepHeader step={5} title="Configurează agentul magazinului" description="Cum se prezintă, ce ton are și ce spune în apelurile automate și la telefon." />
        <AgentForm onBack={() => goTo(4)} onSaved={() => setPhase('voice')} />
      </div>
    )
  }

  if (phase === 'voice') {
    return (
      <div>
        <CommerceStepHeader step={5} title="Alege vocea agentului" description="Ascultă vocile disponibile pentru limba agentului și alege-o pe cea potrivită magazinului." />
        <VoiceStep onBack={() => setPhase('form')} onSaved={() => setPhase('test')} />
      </div>
    )
  }

  return (
    <div>
      <CommerceStepHeader step={5} title="Testează agentul" description="Opțional: vorbește cu agentul din browser înainte de lansare." />
      <StepBody className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] leading-[19px] text-muted-foreground">
          <StatusChip tone="neutral" icon={<Mic className="size-3.5" aria-hidden="true" />}>
            {agent?.voice_name ? `Vocea: ${agent.voice_name}` : 'Voce salvată'}
          </StatusChip>
          <Button variant="link" size="sm" onClick={() => setPhase('voice')} className="h-auto p-0 text-[13px]">
            Schimbă vocea
          </Button>
        </div>

        {agent?.is_active ? (
          <TestAgentPanel variant="onboarding" agentName={agent.name} />
        ) : (
          <Alert role="note">
            <Info aria-hidden="true" />
            <AlertDescription>
              Agentul nu este încă pornit, așa că nu poate fi testat din browser. Vei putea vorbi cu {agent?.name || 'agentul'} imediat după lansare (pasul
              următor) și oricând din pagina Agent.
            </AlertDescription>
          </Alert>
        )}
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={() => setPhase('voice')}>
          <ArrowLeft aria-hidden="true" />
          Înapoi
        </Button>
        <Button type="button" size="lg" onClick={() => goTo(6)} className="ml-auto max-md:flex-1">
          Continuă
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
