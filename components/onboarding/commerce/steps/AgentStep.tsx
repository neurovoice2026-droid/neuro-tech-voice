'use client'

// Step 5 — Your agent: the agent form, then the voice, then an optional
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
        <CommerceStepHeader step={5} title="Set up your store agent" description="How it introduces itself, its tone, and what it says in automated calls and on the phone." />
        <AgentForm onBack={() => goTo(4)} onSaved={() => setPhase('voice')} />
      </div>
    )
  }

  if (phase === 'voice') {
    return (
      <div>
        <CommerceStepHeader step={5} title="Choose the agent's voice" description="Listen to the voices available for the agent's language and pick the one that suits your store." />
        <VoiceStep onBack={() => setPhase('form')} onSaved={() => setPhase('test')} />
      </div>
    )
  }

  return (
    <div>
      <CommerceStepHeader step={5} title="Test your agent" description="Optional: talk to the agent in your browser before launch." />
      <StepBody className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] leading-[19px] text-muted-foreground">
          <StatusChip tone="neutral" icon={<Mic className="size-3.5" aria-hidden="true" />}>
            {agent?.voice_name ? `Voice: ${agent.voice_name}` : 'Voice saved'}
          </StatusChip>
          <Button variant="link" size="sm" onClick={() => setPhase('voice')} className="h-auto p-0 text-[13px]">
            Change voice
          </Button>
        </div>

        {agent?.is_active ? (
          <TestAgentPanel variant="onboarding" agentName={agent.name} />
        ) : (
          <Alert role="note">
            <Info aria-hidden="true" />
            <AlertDescription>
              The agent is not switched on yet, so it cannot be tested in the browser. You will be able to talk to {agent?.name || 'the agent'} right after
              launch (the next step) and any time from the Agent page.
            </AlertDescription>
          </Alert>
        )}
      </StepBody>

      <StepActions>
        <Button type="button" variant="ghost" size="lg" onClick={() => setPhase('voice')}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button type="button" size="lg" onClick={() => goTo(6)} className="ml-auto max-md:flex-1">
          Continue
          <ArrowRight aria-hidden="true" />
        </Button>
      </StepActions>
    </div>
  )
}
