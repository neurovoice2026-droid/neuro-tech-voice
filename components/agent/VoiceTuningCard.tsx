'use client'

// Voice tuning (stability, similarity, speed). Speed also reaches the Cartesia
// fallback agent; stability and similarity are ElevenLabs-only.
// Stored in agents.voice_settings; null means "platform default", which the
// agent sync sends explicitly (0.5 / 0.8 / 1.0) so a reset always reaches the
// live agent.

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FormSection } from '@/components/shared/FormSection'
import { SaveBar } from '@/components/agent/tabs/TabConversation'
import type { AgentHook } from '@/hooks/useAgent'
import { cn } from '@/lib/utils'
import { VoiceTuningSchema, readVoiceTuning } from '@/lib/voice-providers/settings'
import type { VoiceTuning } from '@/lib/voice-providers/types'
import type { Agent } from '@/types'

type TuningKey = keyof VoiceTuning

interface SliderSpec {
  key: TuningKey
  label: string
  min: number
  max: number
  step: number
  /** Value used by the live agent when the tenant keeps the default. */
  defaultValue: number
  hint: string
}

// Ranges and defaults: TTSConversationalConfig in the ElevenLabs OpenAPI spec.
const SLIDERS: SliderSpec[] = [
  {
    key: 'stability',
    label: 'Stability',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.5,
    hint: 'Lower (0.30–0.50) sounds more expressive; higher (0.60–0.85) sounds more consistent from call to call.',
  },
  {
    key: 'similarity_boost',
    label: 'Similarity',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.8,
    hint: 'How closely the agent sticks to the original voice. Very high values can also copy noise from the original recording.',
  },
  {
    key: 'speed',
    label: 'Speed',
    min: 0.7,
    max: 1.2,
    step: 0.05,
    defaultValue: 1,
    hint: '0.9–1.1 sounds natural on the phone. Slower helps callers note down details.',
  },
]

const round = (v: number) => Math.round(v * 100) / 100

interface VoiceTuningCardProps {
  agent: Agent
  onUpdate: AgentHook['updateWithToast']
  isSaving: boolean
}

export function VoiceTuningCard({ agent, onUpdate, isSaving }: VoiceTuningCardProps) {
  const saved = useMemo(() => readVoiceTuning(agent.voice_settings), [agent])
  const [draft, setDraft] = useState<VoiceTuning>(saved)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const parsed = VoiceTuningSchema.safeParse(draft)

  const save = async () => {
    if (!parsed.success) return
    const next = await onUpdate({ voice_settings: parsed.data }, 'Voice tuning saved')
    if (next) setDraft(readVoiceTuning(next.voice_settings))
  }

  return (
    <FormSection
      title="Voice tuning"
      description="Fine-tune how your agent's voice sounds on calls. Changes apply from the next call."
    >
      <div className="divide-y divide-rule [&>*]:py-4 [&>*:first-child]:pt-0">
        {SLIDERS.map((s) => {
          const value = draft[s.key]
          const isDefault = value === null
          const shown = value ?? s.defaultValue
          const id = `voice-tuning-${s.key}`
          return (
            <div key={s.key} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={id}>{s.label}</Label>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-flex h-6 items-center rounded-full px-2 text-xs font-medium tabular-nums',
                      isDefault ? 'text-muted-foreground' : 'bg-secondary text-foreground',
                    )}
                    aria-live="polite"
                  >
                    {isDefault ? `Default (${s.defaultValue.toFixed(2)})` : shown.toFixed(2)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={isDefault}
                    onClick={() => setDraft((d) => ({ ...d, [s.key]: null }))}
                    aria-label={`Reset ${s.label.toLowerCase()} to the default`}
                  >
                    <RotateCcw aria-hidden="true" /> Default
                  </Button>
                </div>
              </div>
              <input
                id={id}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={shown}
                onChange={(e) => setDraft((d) => ({ ...d, [s.key]: round(Number(e.target.value)) }))}
                aria-describedby={`${id}-hint`}
                aria-valuetext={isDefault ? `Default, ${s.defaultValue}` : String(shown)}
                className="h-5 w-full cursor-pointer rounded-full accent-[#140a24] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
              />
              <p id={`${id}-hint`} className="text-xs leading-[18px] text-muted-foreground">
                {s.hint}
              </p>
            </div>
          )
        })}
      </div>
      <p className="text-xs leading-[18px] text-muted-foreground">Speed also applies to the backup voice agent; stability and similarity apply to the primary voice only.</p>
      <SaveBar dirty={isDirty} saving={isSaving} onSave={() => void save()} onDiscard={() => setDraft(saved)} blocked={!parsed.success} />
    </FormSection>
  )
}
