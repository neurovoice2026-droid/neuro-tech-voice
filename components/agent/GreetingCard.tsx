'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Lock, Play, RotateCcw, Sparkles, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { TONE_PROFILES } from '@/lib/voice/tone'
import {
  AI_DISCLOSURE,
  RECORDING_NOTICE,
  applyDisclosure,
  localized,
  mentionsAiDisclosure,
  mentionsRecordingNotice,
} from '@/lib/voice/greetings'
import { defaultCartesiaVoice } from '@/lib/voice/voice-map'
import { cn } from '@/lib/utils'
import { clipForPreview, generatedGreeting, isAutomaticGreeting } from '@/components/agent/greeting'
import type { AgentOrgSummary, AgentPatch, AgentUpdate } from '@/components/agent/types'
import { AGENT_TONES, type Agent, type AgentTone } from '@/types'

export const GREETING_MAX = 600

export type GreetingMode = 'auto' | 'custom'

interface GreetingCardProps {
  agent: Agent
  org: AgentOrgSummary
  mode: GreetingMode
  onModeChange: (mode: GreetingMode) => void
  customText: string
  onCustomTextChange: (text: string) => void
  recordingNotice: boolean
  onRecordingNoticeChange: (value: boolean) => void
  /** Calls are recorded (switch on and the plan includes recordings): the notice is always played. */
  recordsCalls: boolean
  onUpdate: AgentUpdate
  isSaving: boolean
}

type PreviewStatus = 'idle' | 'loading' | 'playing'

function useGreetingPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<PreviewStatus>('idle')

  const release = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    release()
    setStatus('idle')
  }, [release])

  const play = useCallback(
    async (body: { text: string; tone: AgentTone; language: string; voice_id?: string; speed?: number }): Promise<boolean> => {
      stop()
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('loading')
      try {
        const res = await fetch('/api/agent/preview-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: { message?: string } | string } | null
          const message = typeof data?.error === 'object' ? data.error?.message : typeof data?.error === 'string' ? data.error : null
          toast.error('Couldn’t play the preview', { description: message ?? 'Please try again in a moment.' })
          setStatus('idle')
          return false
        }
        const blob = await res.blob()
        if (controller.signal.aborted) return false
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const audio = new Audio(url)
        audio.addEventListener('ended', () => {
          release()
          setStatus('idle')
        })
        audioRef.current = audio
        await audio.play()
        setStatus('playing')
        return true
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return false
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          // The browser blocked sound that didn't follow a click (an automatic replay).
          audioRef.current = null
          release()
          setStatus('idle')
          toast.message('Press Play greeting to listen')
          return false
        }
        toast.error('Couldn’t play the preview', { description: 'Check your connection and try again.' })
        setStatus('idle')
        return false
      }
    },
    [release, stop]
  )

  useEffect(() => stop, [stop])

  return { status, play, stop }
}

export function GreetingCard({
  agent,
  org,
  mode,
  onModeChange,
  customText,
  onCustomTextChange,
  recordingNotice,
  onRecordingNoticeChange,
  recordsCalls,
  onUpdate,
  isSaving,
}: GreetingCardProps) {
  const orgName = org.name ?? ''
  const [previewTone, setPreviewTone] = useState<AgentTone>(agent.tone)
  const [previewLanguage, setPreviewLanguage] = useState(agent.language)
  // Follow the agent when its saved tone or language changes (derived state).
  const [followed, setFollowed] = useState({ tone: agent.tone, language: agent.language })
  if (followed.tone !== agent.tone || followed.language !== agent.language) {
    setFollowed({ tone: agent.tone, language: agent.language })
    setPreviewTone(agent.tone)
    setPreviewLanguage(agent.language)
  }

  const greetingText =
    mode === 'auto'
      ? generatedGreeting({ language: previewLanguage, tone: previewTone, orgName, agentName: agent.name })
      : customText
  const noticeOn = recordingNotice || recordsCalls
  const spoken = applyDisclosure(greetingText, { language: previewLanguage, businessName: orgName, recordingNotice: noticeOn })
  const disclosure = localized(AI_DISCLOSURE, previewLanguage)
  const notice = localized(RECORDING_NOTICE, previewLanguage)
  const greetingDiscloses = mentionsAiDisclosure(greetingText, orgName)
  const greetingMentionsRecording = mentionsRecordingNotice(greetingText, orgName)

  const { status, play, stop } = useGreetingPreview()
  const liveRef = useRef(false)
  const latest = useRef({ spoken, previewTone, previewLanguage })
  useEffect(() => {
    latest.current = { spoken, previewTone, previewLanguage }
  })

  const startPreview = useCallback(async () => {
    const { spoken: text, previewTone: tone, previewLanguage: language } = latest.current
    const clip = clipForPreview(text)
    if (!clip.text) return
    const body: { text: string; tone: AgentTone; language: string; voice_id?: string; speed?: number } = {
      text: clip.text,
      tone,
      language,
    }
    // Another language needs a voice that speaks it; the agent's own voice is used otherwise.
    if (language !== agent.language) body.voice_id = defaultCartesiaVoice(language).voice_id
    if (typeof agent.voice_speed === 'number') body.speed = agent.voice_speed
    const ok = await play(body)
    if (ok) liveRef.current = true
  }, [agent.language, agent.voice_speed, play])

  // Once the owner has listened, changing the tone or language replays it:
  // hear the greeting change as you do.
  useEffect(() => {
    if (!liveRef.current) return
    const timer = window.setTimeout(() => void startPreview(), 450)
    return () => window.clearTimeout(timer)
  }, [previewTone, previewLanguage, startPreview])

  const previewDiffers = previewTone !== agent.tone || previewLanguage !== agent.language
  const clipped = clipForPreview(spoken).clipped
  const textTooLong = mode === 'custom' && customText.length > GREETING_MAX

  const applyPreviewSettings = async () => {
    const payload: AgentPatch = { tone: previewTone, language: previewLanguage }
    // A stored greeting that was generated for the old tone or language follows
    // the new ones (same rule as the General tab); a greeting the owner wrote is kept.
    if (agent.first_message?.trim() && isAutomaticGreeting(agent, org.name)) payload.first_message = ''
    const ok = await onUpdate(payload, `Your agent now uses the ${TONE_PROFILES[previewTone].label.toLowerCase()} tone`)
    if (!ok) return
    if (previewLanguage !== agent.language) {
      toast.message('Check your voice', { description: 'Pick a voice that speaks the new language on the Voice tab.' })
    }
  }

  const languageOption = (value: string) => AGENT_LANGUAGES.find((l) => l.value === value)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Greeting</CardTitle>
        <CardDescription>The first thing callers hear. Keep it short: under 30 words works best.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role="radiogroup" aria-label="Greeting type" className="inline-flex rounded-lg border p-0.5">
          {(
            [
              { value: 'auto', label: 'Automatic' },
              { value: 'custom', label: 'Write my own' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              onClick={() => {
                if (option.value === 'custom' && !customText.trim()) {
                  onCustomTextChange(generatedGreeting({ language: previewLanguage, tone: previewTone, orgName, agentName: agent.name }))
                }
                onModeChange(option.value)
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                mode === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'auto' ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            {greetingText}
            <span className="mt-1 block text-xs text-muted-foreground">
              Written for your tone and language, and updated automatically when you change them.
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="greeting-text" className="sr-only">
              Your greeting
            </Label>
            <Textarea
              id="greeting-text"
              value={customText}
              onChange={(e) => onCustomTextChange(e.target.value)}
              rows={3}
              className="resize-none"
              aria-invalid={textTooLong}
              aria-describedby="greeting-text-help"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onCustomTextChange(generatedGreeting({ language: previewLanguage, tone: previewTone, orgName, agentName: agent.name }))
                }
              >
                <Sparkles aria-hidden="true" />
                Generate
              </Button>
              <p id="greeting-text-help" className={cn('text-xs', textTooLong ? 'text-destructive' : 'text-muted-foreground')}>
                {customText.length}/{GREETING_MAX}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="preview-tone" className="text-xs text-muted-foreground">
                  Tone
                </Label>
                <Select value={previewTone} onValueChange={(v) => v && setPreviewTone(v as AgentTone)}>
                  <SelectTrigger id="preview-tone" className="w-full">
                    <SelectValue>{(value: string) => TONE_PROFILES[value as AgentTone]?.label ?? value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TONE_PROFILES[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preview-language" className="text-xs text-muted-foreground">
                  Language
                </Label>
                <Select value={previewLanguage} onValueChange={(v) => v && setPreviewLanguage(v)}>
                  <SelectTrigger id="preview-language" className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        const l = languageOption(value)
                        return l ? (
                          <span className="flex items-center gap-2">
                            <FlagIcon country={l.country} />
                            {l.label}
                          </span>
                        ) : (
                          value
                        )
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        <span className="flex items-center gap-2">
                          <FlagIcon country={l.country} />
                          {l.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => (status === 'idle' ? void startPreview() : stop())}
              disabled={!greetingText.trim()}
              className="sm:w-36"
            >
              {status === 'loading' ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : status === 'playing' ? (
                <Square aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {status === 'loading' ? 'Loading…' : status === 'playing' ? 'Stop' : 'Play greeting'}
            </Button>
          </div>

          {previewDiffers && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">You’re previewing a different tone or language. Your agent isn’t changed.</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setPreviewTone(agent.tone)
                    setPreviewLanguage(agent.language)
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </Button>
                <Button type="button" size="xs" variant="outline" onClick={applyPreviewSettings} disabled={isSaving}>
                  Use for my agent
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground">What callers hear</p>
            <p className="mt-1 text-sm leading-relaxed" dir={previewLanguage === 'ar' ? 'rtl' : undefined}>
              {spoken}
            </p>
            {clipped && (
              <p className="mt-1 text-xs text-muted-foreground">The preview plays the first 300 characters.</p>
            )}
          </div>

          <ul className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {greetingDiscloses ? (
                  'Your greeting already tells callers they’re speaking with an AI assistant, so nothing is added.'
                ) : (
                  <>
                    Added automatically: <span className="text-foreground">“{disclosure}”</span> Callers are always told they’re speaking with an AI assistant.
                  </>
                )}
              </span>
            </li>
            {noticeOn && (
              <li className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {greetingMentionsRecording ? (
                    'Your greeting already mentions recording, so nothing is added.'
                  ) : (
                    <>
                      Added automatically: <span className="text-foreground">“{notice}”</span>
                    </>
                  )}
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="recording-notice" className="text-sm font-medium">
              Tell callers the call may be recorded
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {recordsCalls
                ? 'Call recording is on, so this notice is always played.'
                : 'Adds a short recording notice after the greeting.'}
            </p>
          </div>
          <Switch
            id="recording-notice"
            checked={noticeOn}
            onCheckedChange={onRecordingNoticeChange}
            disabled={recordsCalls}
          />
        </div>
      </CardContent>
    </Card>
  )
}
