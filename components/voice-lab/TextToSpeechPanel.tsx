'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AudioLines, Download, Loader2, Pause, SpellCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { errorMessage, fetchBlob, VoiceApiError } from '@/components/voice/api'
import { LanguageSelect } from '@/components/voice/LanguageSelect'
import { SpeedControl } from '@/components/voice/SpeedControl'
import { languageLabel, speedLabel, TTS_TOOL_MAX_CHARS } from '@/components/voice/voice-options'
import { defaultVoiceFor, recommendedVoiceIds } from '@/components/voice/default-voices'
import { VoicePicker } from '@/components/voice/VoicePicker'
import { cn } from '@/lib/utils'
import type { Voice } from '@/types'
import { QuotaMeter } from './QuotaMeter'
import type { VoiceLabUsage } from './use-voice-lab-usage'

interface TextToSpeechPanelProps {
  defaultLanguage: string
  usage: VoiceLabUsage | null
  /** Loading the allowance failed (the page shows why). */
  usageUnavailable?: boolean
  onQuotaHeaders: (headers: Headers) => void
}

interface Generation {
  id: string
  url: string
  format: 'mp3' | 'wav'
  voiceName: string
  language: string
  speed: number | null
  characters: number
  excerpt: string
  createdAt: Date
}

const MAX_RESULTS = 5

function fileName(generation: Generation): string {
  const stamp = generation.createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const voice = generation.voiceName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'voice'
  return `speech-${voice}-${stamp}.${generation.format}`
}

export function TextToSpeechPanel({ defaultLanguage, usage, usageUnavailable = false, onQuotaHeaders }: TextToSpeechPanelProps) {
  const ids = useId()
  const [text, setText] = useState('')
  // Starts on our recommended voice for the agent's language, so the tool works without browsing first.
  const [voice, setVoice] = useState<Voice | null>(() => defaultVoiceFor(defaultLanguage))
  const recommendedIds = useMemo(() => recommendedVoiceIds(defaultLanguage), [defaultLanguage])
  const [language, setLanguage] = useState(defaultLanguage)
  const [speed, setSpeed] = useState<number | null>(null)
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<Generation[]>([])
  const resultsRef = useRef<Generation[]>([])
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    resultsRef.current = results
  }, [results])

  // Object URLs live as long as the page.
  useEffect(() => () => resultsRef.current.forEach((r) => URL.revokeObjectURL(r.url)), [])

  const characters = text.trim().length
  const remaining = usage?.tts.remaining ?? null
  const overQuota = remaining !== null && characters > remaining
  const configured = usage?.configured ?? true
  const canGenerate = Boolean(voice && characters > 0 && !overQuota && configured && !generating)

  /**
   * Inserts one of Cartesia's inline tags at the cursor: <break time="…"/> for
   * a pause, <spell>…</spell> around the selection to read it letter by letter.
   */
  function insertTag(kind: 'pause' | 'spell') {
    const el = textRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const selected = text.slice(start, end)
    const insert = kind === 'pause' ? '<break time="1s"/>' : `<spell>${selected || 'ABC123'}</spell>`
    const next = text.slice(0, start) + insert + text.slice(end)
    if (next.length > TTS_TOOL_MAX_CHARS) {
      toast.error(`The script can be up to ${TTS_TOOL_MAX_CHARS.toLocaleString('en-US')} characters.`)
      return
    }
    setText(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = kind === 'spell' && !selected ? start + '<spell>'.length : start + insert.length
      el.setSelectionRange(caret, kind === 'spell' && !selected ? caret + 'ABC123'.length : caret)
    })
  }

  async function generate() {
    if (!voice || !canGenerate) return
    setGenerating(true)
    try {
      const { blob, headers } = await fetchBlob('/api/voice-lab/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), voice_id: voice.id, language, speed, format }),
      })
      onQuotaHeaders(headers)
      const generation: Generation = {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(blob),
        format,
        voiceName: voice.name,
        language,
        speed,
        characters,
        excerpt: text.trim().slice(0, 90),
        createdAt: new Date(),
      }
      setResults((current) => {
        const next = [generation, ...current]
        next.slice(MAX_RESULTS).forEach((old) => URL.revokeObjectURL(old.url))
        return next.slice(0, MAX_RESULTS)
      })
    } catch (error) {
      // A quota refusal carries the current allowance: keep the meter honest.
      if (error instanceof VoiceApiError && error.headers) onQuotaHeaders(error.headers)
      toast.error(errorMessage(error, 'We couldn’t generate the audio. Please try again.'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Script</CardTitle>
            <CardDescription>Type what you want spoken: greetings, on-hold messages, announcements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${ids}-text`}>Text</Label>
                <span
                  className={cn('text-xs tabular-nums', characters > TTS_TOOL_MAX_CHARS * 0.9 ? 'text-amber-600' : 'text-muted-foreground')}
                  aria-live="polite"
                >
                  {characters.toLocaleString('en-US')} / {TTS_TOOL_MAX_CHARS.toLocaleString('en-US')}
                </span>
              </div>
              <Textarea
                ref={textRef}
                id={`${ids}-text`}
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, TTS_TOOL_MAX_CHARS))}
                maxLength={TTS_TOOL_MAX_CHARS}
                rows={7}
                placeholder="Thanks for calling. Our office is open Monday to Friday from 9 to 6."
                aria-describedby={overQuota ? `${ids}-quota ${ids}-tags` : `${ids}-tags`}
                className="min-h-40 resize-y"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="xs" onClick={() => insertTag('pause')} disabled={generating}>
                  <Pause aria-hidden="true" /> Add a pause
                </Button>
                <Button type="button" variant="outline" size="xs" onClick={() => insertTag('spell')} disabled={generating}>
                  <SpellCheck aria-hidden="true" /> Spell out
                </Button>
                <p id={`${ids}-tags`} className="min-w-0 text-xs text-muted-foreground">
                  Pauses and spelled-out codes, like booking references, count toward the characters.
                </p>
              </div>
              {overQuota && (
                <p id={`${ids}-quota`} className="text-xs text-destructive">
                  This is longer than the {remaining?.toLocaleString('en-US')} characters you have left this period.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-language`}>Language</Label>
                <LanguageSelect id={`${ids}-language`} value={language} onChange={setLanguage} disabled={generating} />
              </div>
              <div className="space-y-1.5">
                <span id={`${ids}-format`} className="text-sm font-medium text-foreground">
                  File type
                </span>
                <div role="radiogroup" aria-labelledby={`${ids}-format`} className="flex rounded-lg border bg-muted/50 p-0.5">
                  {(['mp3', 'wav'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={format === option}
                      onClick={() => setFormat(option)}
                      className={cn(
                        'flex-1 rounded-md px-3 py-1.5 text-xs font-medium uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                        format === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <SpeedControl id={`${ids}-pace`} value={speed} onChange={setSpeed} disabled={generating} />

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 text-xs text-muted-foreground">
                {voice ? (
                  <>
                    Voice: <span className="font-medium text-foreground">{voice.name}</span>
                  </>
                ) : (
                  'Pick a voice to generate audio.'
                )}
              </p>
              <Button type="button" onClick={generate} disabled={!canGenerate} className="purple-glow w-full sm:w-auto">
                {generating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                {generating ? 'Generating…' : 'Generate audio'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <QuotaMeter label="Text to speech this period" allowance={usage?.tts ?? null} unavailable={usageUnavailable} unit="characters" resetsAt={usage?.period.end ?? null} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your audio</CardTitle>
            <CardDescription>The last {MAX_RESULTS} generations stay here until you leave the page.</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <EmptyState
                icon={AudioLines}
                title={generating ? 'Generating your audio…' : 'Nothing generated yet'}
                description="Write a script, pick a voice and press Generate audio."
                className="py-8"
              />
            ) : (
              <ul className="space-y-3">
                {results.map((result) => (
                  <li key={result.id} className="space-y-2 rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{result.voiceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {languageLabel(result.language)} · pace {speedLabel(result.speed).toLowerCase()} ·{' '}
                          {result.characters.toLocaleString('en-US')} characters · {result.format.toUpperCase()}
                        </p>
                      </div>
                      <a
                        href={result.url}
                        download={fileName(result)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[0.8rem] font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <Download className="size-3.5" aria-hidden="true" /> Download
                      </a>
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">“{result.excerpt}”</p>
                    <audio controls src={result.url} className="h-9 w-full" aria-label={`Generated audio in ${result.voiceName}’s voice`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 self-start">
        <CardHeader>
          <CardTitle className="text-base">Voice</CardTitle>
          <CardDescription>Preview and pick the voice for this script.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoicePicker
            value={voice?.id ?? null}
            onChange={setVoice}
            defaultLanguage={defaultLanguage}
            recommendedIds={recommendedIds}
            compact
          />
        </CardContent>
      </Card>
    </div>
  )
}
