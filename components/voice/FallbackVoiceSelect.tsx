'use client'

import { useEffect, useId, useState } from 'react'
import { Info, Loader2, RotateCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PreviewButton, genderLabel, languageDisplay } from '@/components/voice/VoiceCard'
import { useAudioPreview, type PreviewRequest } from '@/hooks/useAudioPreview'
import { errorMessage, isAbortError, parseApiError } from '@/hooks/useVoiceCatalog'
import type { Agent } from '@/types'

interface FallbackVoice {
  voiceId: string
  name: string
  gender: string | null
  language: string | null
  hasPreview: boolean
}

interface FallbackCurrent {
  voiceId: string | null
  source: 'agent' | 'platform_map' | 'auto' | null
}

interface FallbackVoicesResponse {
  voices: FallbackVoice[]
  current: FallbackCurrent
}

type LoadResult =
  | { key: string; ok: true; data: FallbackVoicesResponse }
  | { key: string; ok: false; message: string; notConfigured: boolean }

interface PatchAgentResponse {
  agent: Agent
  sync?: Array<{ provider: string; status: string; error: string | null }>
}

export interface FallbackVoiceSelectProps {
  agent: Agent
  onAgentUpdated: (agent: Agent) => void
}

/** Select value for "Automatic (recommended)" (fallback_voice_id = null). */
const AUTO = '__auto__'

function normalize(raw: unknown): FallbackVoicesResponse {
  const record = raw && typeof raw === 'object' ? (raw as Partial<FallbackVoicesResponse>) : {}
  const voices = Array.isArray(record.voices)
    ? record.voices.filter((v): v is FallbackVoice => !!v && typeof v.voiceId === 'string' && typeof v.name === 'string')
    : []
  const current: FallbackCurrent =
    record.current && typeof record.current === 'object'
      ? { voiceId: record.current.voiceId ?? null, source: record.current.source ?? null }
      : { voiceId: null, source: null }
  return { voices, current }
}

function previewRequest(voiceId: string): PreviewRequest {
  return {
    kind: 'request',
    url: `/api/voices/fallback/preview?voice_id=${encodeURIComponent(voiceId)}`,
    method: 'GET',
  }
}

function voiceLabel(v: FallbackVoice): string {
  const gender = genderLabel(v.gender)
  return gender ? `${v.name} · ${gender}` : v.name
}

export function FallbackVoiceSelect({ agent, onAgentUpdated }: FallbackVoiceSelectProps) {
  const labelId = useId()
  const preview = useAudioPreview()
  const [reloadToken, setReloadToken] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)
  const [savingValue, setSavingValue] = useState<string | null>(null)

  const language = agent.language || 'en'
  const key = `${language}#${reloadToken}`

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const res = await fetch(`/api/voices/fallback?language=${encodeURIComponent(language)}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          const err = await parseApiError(res, 'Could not load fallback voices.')
          if (controller.signal.aborted) return
          setResult({
            key,
            ok: false,
            message: err.message,
            notConfigured: res.status === 503 && err.code === 'not_configured',
          })
          return
        }
        const data = normalize(await res.json())
        if (controller.signal.aborted) return
        setResult({ key, ok: true, data })
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return
        setResult({ key, ok: false, message: errorMessage(err, 'Could not load fallback voices.'), notConfigured: false })
      }
    }
    void load()
    return () => controller.abort()
  }, [key, language])

  const loaded = result && result.key === key ? result : null
  const saving = savingValue !== null
  const savedValue = agent.fallback_voice_id ?? AUTO
  const value = savingValue ?? savedValue
  const langLabel = languageDisplay(language)?.label ?? language.toUpperCase()

  async function save(next: string) {
    if (saving || next === savedValue) return
    preview.stop()
    setSavingValue(next)
    try {
      const res = await fetch('/api/agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ fallback_voice_id: next === AUTO ? null : next }),
      })
      if (!res.ok) throw await parseApiError(res, 'Could not update the fallback voice.')
      const json = (await res.json()) as PatchAgentResponse
      onAgentUpdated(json.agent)
      const syncFailure = json.sync?.find(
        (s) => s.provider === 'cartesia' && (s.status === 'failed' || s.status === 'error'),
      )
      if (syncFailure) {
        toast.warning('Fallback voice saved, but the backup agent was not updated', {
          description: syncFailure.error ?? 'Try again in a few minutes.',
        })
      } else {
        toast.success(next === AUTO ? 'Fallback voice set to automatic' : 'Fallback voice updated')
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the fallback voice.'))
    } finally {
      setSavingValue(null)
    }
  }

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
        Fallback voice
      </CardTitle>
      <CardDescription>
        Used only when the primary voice provider is unavailable and your backup agent (Cartesia) answers the
        call. This is not the conversational fallback message your agent says when it doesn&apos;t understand a
        caller.
      </CardDescription>
    </CardHeader>
  )

  if (!loaded) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full sm:w-80" />
        </CardContent>
      </Card>
    )
  }

  if (!loaded.ok) {
    return (
      <Card>
        {header}
        <CardContent>
          {loaded.notConfigured ? (
            <div className="flex gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-medium">Fallback provider not configured</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Calls are answered by your primary voice provider only. There is nothing to choose here yet.
                </p>
              </div>
            </div>
          ) : (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="min-w-0 flex-1 text-sm text-destructive">{loaded.message}</p>
              <Button variant="outline" size="sm" onClick={() => setReloadToken((n) => n + 1)} className="gap-1.5">
                <RotateCw aria-hidden="true" /> Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const { voices, current } = loaded.data
  const byId = new Map(voices.map((v) => [v.voiceId, v]))
  const items: Record<string, string> = { [AUTO]: 'Automatic (recommended)' }
  for (const v of voices) items[v.voiceId] = voiceLabel(v)
  // A saved voice that is not offered for this language any more still shows.
  if (savedValue !== AUTO && !items[savedValue]) items[savedValue] = 'Saved voice (not listed for this language)'

  // What "Automatic" resolves to right now, when the server told us.
  const autoVoice = current.source !== 'agent' && current.voiceId ? byId.get(current.voiceId) : undefined
  const previewId = value === AUTO ? (current.source !== 'agent' ? current.voiceId : null) : value
  const previewVoice = previewId ? byId.get(previewId) : undefined
  const canPreview = !!previewId && previewVoice?.hasPreview !== false
  const previewName = previewVoice?.name ?? 'the fallback voice'

  return (
    <Card>
      {header}
      <CardContent className="space-y-2">
        <p id={labelId} className="text-sm font-medium">
          Backup voice for {langLabel}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select items={items} value={value} onValueChange={(v) => typeof v === 'string' && void save(v)} disabled={saving}>
            <SelectTrigger aria-labelledby={labelId} className="h-9 w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(items).map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving…
              </span>
            ) : (
              <PreviewButton
                name={previewName}
                variant="wide"
                className="w-auto px-3"
                status={previewId ? preview.statusFor(previewId) : 'idle'}
                disabled={!canPreview}
                onClick={() => previewId && preview.toggle(previewId, previewRequest(previewId))}
              />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {value === AUTO
            ? autoVoice
              ? `Automatic currently uses ${autoVoice.name}, a voice tuned for ${langLabel}.`
              : `We pick a natural ${langLabel} voice for the backup agent.`
            : !canPreview && previewId
              ? 'No preview is available for this voice.'
              : 'Pick a voice close to your main voice so callers notice the switch as little as possible.'}
        </p>
      </CardContent>
    </Card>
  )
}
