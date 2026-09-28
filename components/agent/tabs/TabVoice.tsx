'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info, Loader2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { AudioPreviewButton } from '@/components/voice/AudioPreviewButton'
import { errorMessage, fetchJson } from '@/components/voice/api'
import { playPreview, spokenPreviewLoader } from '@/components/voice/preview-player'
import { SpeedControl } from '@/components/voice/SpeedControl'
import { languageOption, PREVIEW_MAX_CHARS, speedLabel } from '@/components/voice/voice-options'
import { sampleFor } from '@/components/voice/voice-samples'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { recommendedVoiceIds } from '@/components/voice/default-voices'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { TONE_PROFILES, normalizeTone, voiceStyleFor } from '@/lib/voice/tone'
import { defaultCartesiaVoice } from '@/lib/voice/voice-map'
import type { Agent, Voice } from '@/types'

export interface TabVoiceProps {
  agent: Agent
  /**
   * useAgent().updateVoice: PATCH /api/agent/voice, updates the page's agent
   * state and shows its own toasts. Without it the tab calls the API directly
   * and refreshes the page data.
   */
  onUpdateVoice?: (voiceId: string, voiceName: string) => Promise<boolean>
  /** useAgent().update, used for the pace (PATCH /api/agent { voice_speed }). Same fallback. */
  onUpdate?: (payload: { voice_speed: number | null }) => Promise<boolean>
  /** Another save on the page is running; Apply waits for it. */
  isSaving?: boolean
}

interface SavedVoice {
  id: string
  name: string
  speed: number | null
}

function savedFromAgent(agent: Agent): SavedVoice {
  const fallback = defaultCartesiaVoice(agent.language)
  return {
    id: agent.cartesia_voice_id ?? fallback.voice_id,
    name: agent.cartesia_voice_id ? agent.cartesia_voice_name ?? 'Custom voice' : fallback.name,
    speed: typeof agent.voice_speed === 'number' ? agent.voice_speed : null,
  }
}

/** The greeting callers hear, trimmed to what a preview may speak. */
function previewText(agent: Agent): string {
  const greeting = agent.first_message?.trim()
  if (!greeting) return sampleFor(agent.language).text
  if (greeting.length <= PREVIEW_MAX_CHARS) return greeting
  const cut = greeting.slice(0, PREVIEW_MAX_CHARS)
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return sentenceEnd > 80 ? cut.slice(0, sentenceEnd + 1) : cut.slice(0, cut.lastIndexOf(' ')).trim()
}

/**
 * The pace calls really use: the chosen pace, else the tone's suggestion
 * (voiceStyleFor, the same rule as live calls), else the voice's natural pace.
 * Previews send it explicitly so they sound exactly like a call.
 */
function effectiveSpeed(agent: Agent, language: string, speed: number | null): number {
  return voiceStyleFor({ tone: agent.tone, language, speed }).speed ?? 1
}

function sameSpeed(a: number | null, b: number | null): boolean {
  return (a ?? 1).toFixed(2) === (b ?? 1).toFixed(2)
}

async function patchDirect(url: string, body: unknown, failure: string): Promise<boolean> {
  try {
    await fetchJson<unknown>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return true
  } catch (error) {
    toast.error(errorMessage(error, failure))
    return false
  }
}

export function TabVoice({ agent, onUpdateVoice, onUpdate, isSaving = false }: TabVoiceProps) {
  const router = useRouter()
  const language = normalizeAgentLanguage(agent.language)
  const languageInfo = languageOption(language)

  // Saved state follows the agent prop, and is updated locally right after a
  // save so the tab doesn't wait for the page data to refresh.
  const agentKey = `${agent.id}|${agent.cartesia_voice_id ?? ''}|${agent.cartesia_voice_name ?? ''}|${agent.voice_speed ?? ''}|${agent.language}`
  const [trackedKey, setTrackedKey] = useState(agentKey)
  const [saved, setSaved] = useState<SavedVoice>(() => savedFromAgent(agent))
  const [draft, setDraft] = useState<SavedVoice>(() => savedFromAgent(agent))
  const [applying, setApplying] = useState(false)

  if (trackedKey !== agentKey) {
    const next = savedFromAgent(agent)
    const dirty = draft.id !== saved.id || !sameSpeed(draft.speed, saved.speed)
    setTrackedKey(agentKey)
    setSaved(next)
    if (!dirty) setDraft(next)
  }

  const recommendedIds = useMemo(() => recommendedVoiceIds(language), [language])

  const text = previewText(agent)
  const tone = TONE_PROFILES[normalizeTone(agent.tone)]
  const savedPace = effectiveSpeed(agent, language, saved.speed)
  const toneNote =
    tone.speed !== null && Math.abs(tone.speed - 1) > 0.001
      ? `With the slider on Natural, your ${tone.label.toLowerCase()} tone sets the pace to ${speedLabel(tone.speed)}.`
      : undefined
  const voiceChanged = draft.id !== saved.id
  const speedChanged = !sameSpeed(draft.speed, saved.speed)
  const dirty = voiceChanged || speedChanged

  function previewDraft(speed: number | null) {
    const pace = effectiveSpeed(agent, language, speed)
    void playPreview(
      `pace:${draft.id}:${pace.toFixed(2)}:${text}`,
      spokenPreviewLoader({ text, voice_id: draft.id, speed: pace, tone: tone.id, language })
    )
  }

  async function apply() {
    if (!dirty || applying) return
    setApplying(true)
    const target = draft
    let usedDirectCall = false
    try {
      if (voiceChanged) {
        let ok: boolean
        if (onUpdateVoice) {
          // The page hook shows "Voice updated" or the error itself.
          ok = await onUpdateVoice(target.id, target.name)
        } else {
          usedDirectCall = true
          ok = await patchDirect(
            '/api/agent/voice',
            { cartesia_voice_id: target.id, cartesia_voice_name: target.name },
            'We couldn’t change the voice. Please try again.'
          )
        }
        if (!ok) return
        setSaved((current) => ({ ...current, id: target.id, name: target.name }))
      }

      if (speedChanged) {
        let ok: boolean
        if (onUpdate) {
          ok = await onUpdate({ voice_speed: target.speed })
        } else {
          usedDirectCall = true
          ok = await patchDirect('/api/agent', { voice_speed: target.speed }, 'We couldn’t save the pace. Please try again.')
        }
        if (!ok) return
        setSaved((current) => ({ ...current, speed: target.speed }))
        if (!(voiceChanged && onUpdateVoice)) {
          toast.success(voiceChanged ? 'Voice and pace updated' : 'Pace updated', { description: 'New calls use it straight away.' })
        }
      } else if (!onUpdateVoice) {
        toast.success('Voice updated', { description: 'New calls use it straight away.' })
      }
    } finally {
      setApplying(false)
      // Without the page hook, reload the page data so the header and other tabs match.
      if (usedDirectCall) router.refresh()
    }
  }

  function handleCloneDeleted(voice: Voice, replacement: { id: string; name: string } | null) {
    if (voice.id === saved.id && replacement) {
      const next = { ...saved, id: replacement.id, name: replacement.name }
      setSaved(next)
      setDraft((current) => (current.id === voice.id ? { ...current, id: replacement.id, name: replacement.name } : current))
      router.refresh()
    } else if (voice.id === draft.id) {
      setDraft((current) => ({ ...current, id: saved.id, name: saved.name }))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current voice</CardTitle>
          <CardDescription>What callers hear when your agent answers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Volume2 className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{saved.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {languageInfo && <FlagIcon country={languageInfo.country} className="h-3 w-4" />}
                  <span className="truncate">
                    {languageInfo?.label ?? language} · Pace {speedLabel(savedPace).toLowerCase()}
                    {!agent.cartesia_voice_id && ' · Default voice'}
                  </span>
                </p>
              </div>
            </div>
            <AudioPreviewButton
              previewKey={`greeting:${saved.id}:${savedPace.toFixed(2)}:${text}`}
              load={spokenPreviewLoader({ text, voice_id: saved.id, speed: savedPace, tone: tone.id, language })}
              label={`your greeting in ${saved.name}’s voice`}
              text="Hear greeting"
              className="w-full sm:w-auto"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pace</CardTitle>
          <CardDescription>How quickly the agent speaks. Let go of the slider to hear it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SpeedControl
            id={`voice-pace-${agent.id}`}
            value={draft.speed}
            onChange={(speed) => setDraft((current) => ({ ...current, speed }))}
            onCommit={previewDraft}
            disabled={applying}
            description={toneNote}
          />
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>
              Pitch is part of each voice, so there’s no pitch slider. For a higher or deeper sound, choose a different voice
              below and preview it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a voice</CardTitle>
          <CardDescription>
            Preview voices by language, accent and style, or clone your own. Changes apply when you press Apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoicePicker
            value={draft.id}
            onChange={(voice) => setDraft((current) => ({ ...current, id: voice.id, name: voice.name }))}
            defaultLanguage={language}
            recommendedIds={recommendedIds}
            onCloneDeleted={handleCloneDeleted}
            allowClone
          />
        </CardContent>
      </Card>

      {dirty && (
        <div
          role="region"
          aria-label="Unsaved voice changes"
          className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center"
        >
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium text-foreground">{draft.name}</span>
            <span className="text-muted-foreground"> · pace {speedLabel(draft.speed).toLowerCase()} · not applied yet</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft(saved)} disabled={applying} className="flex-1 sm:flex-none">
              Discard
            </Button>
            <Button type="button" size="sm" onClick={apply} disabled={applying || isSaving} className="purple-glow flex-1 sm:flex-none">
              {applying && <Loader2 className="animate-spin" aria-hidden="true" />}
              {applying ? 'Applying…' : 'Apply changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
