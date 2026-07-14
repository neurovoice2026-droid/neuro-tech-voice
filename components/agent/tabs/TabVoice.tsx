'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Play, Square, Check, Volume2, Mic, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { Agent, ElevenLabsVoice } from '@/types'
import type { useAgent } from '@/hooks/useAgent'

const VOICE_CATEGORIES = ['All', 'premade', 'cloned', 'professional']

type AgentHook = ReturnType<typeof useAgent>

interface TabVoiceProps {
  agent: Agent
  onUpdateVoice: AgentHook['updateVoice']
  isSaving: boolean
}

export function TabVoice({ agent, onUpdateVoice, isSaving }: TabVoiceProps) {
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selectedVoiceId, setSelectedVoiceId] = useState(agent.voice_id ?? '')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const hasPendingChange = selectedVoiceId && selectedVoiceId !== agent.voice_id

  useEffect(() => {
    async function fetchVoices() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/elevenlabs/voices')
        if (res.ok) {
          const data = await res.json() as { voices: ElevenLabsVoice[] }
          setVoices(data.voices ?? [])
        }
      } catch {
        // Silently fail — voices list stays empty
      } finally {
        setIsLoading(false)
      }
    }
    fetchVoices()
  }, [])

  const filtered = voices.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || v.category === category
    return matchSearch && matchCat
  })

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingId(null)
  }

  const playPreview = async (voice: ElevenLabsVoice) => {
    if (playingId === voice.voice_id) {
      stopAudio()
      return
    }

    stopAudio()

    // Try preview_url first (ElevenLabs provides these for premade voices)
    if (voice.preview_url) {
      const audio = new Audio(voice.preview_url)
      audioRef.current = audio
      setPlayingId(voice.voice_id)
      audio.play()
      audio.addEventListener('ended', () => {
        setPlayingId(null)
        audioRef.current = null
      })
      return
    }

    // Otherwise generate via TTS
    setPreviewingId(voice.voice_id)
    try {
      const res = await fetch('/api/agent/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello! I am your AI voice agent. How can I help you today?', voice_id: voice.voice_id }),
      })
      if (!res.ok) {
        toast.error('Could not generate voice preview')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      setPlayingId(voice.voice_id)
      audio.play()
      audio.addEventListener('ended', () => {
        setPlayingId(null)
        audioRef.current = null
        URL.revokeObjectURL(url)
      })
    } catch {
      toast.error('Could not generate voice preview')
    } finally {
      setPreviewingId(null)
    }
  }

  const handleSave = async () => {
    const voice = voices.find(v => v.voice_id === selectedVoiceId)
    if (!voice) return
    await onUpdateVoice(voice.voice_id, voice.name)
  }

  return (
    <div className="space-y-6">
      {/* Current Voice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Voice</CardTitle>
          <CardDescription>The voice your agent uses in calls right now.</CardDescription>
        </CardHeader>
        <CardContent>
          {agent.voice_id ? (
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Volume2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{agent.voice_name ?? 'Unknown voice'}</p>
                <p className="text-xs text-muted-foreground font-mono">{agent.voice_id}</p>
              </div>
              <Badge variant="secondary" className="ml-auto">Active</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mic className="size-4" />
              No voice selected — pick one below
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voice Picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Voice</CardTitle>
          <CardDescription>
            Browse and preview our full voice library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search voices…"
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {VOICE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={[
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    category === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-muted-foreground/50 text-muted-foreground',
                  ].join(' ')}
                >
                  {cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Voice grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No voices match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
              {filtered.map(voice => {
                const isSelected = selectedVoiceId === voice.voice_id
                const isPlaying = playingId === voice.voice_id
                const isPreviewing = previewingId === voice.voice_id

                return (
                  <div
                    key={voice.voice_id}
                    onClick={() => setSelectedVoiceId(voice.voice_id)}
                    className={[
                      'flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/40',
                    ].join(' ')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{voice.name}</p>
                        {voice.labels?.gender && (
                          <Badge variant="outline" className="text-xs shrink-0">{voice.labels.gender}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {voice.category}
                        {voice.labels?.accent ? ` · ${voice.labels.accent}` : ''}
                        {voice.labels?.age ? ` · ${voice.labels.age}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); playPreview(voice) }}
                        disabled={isPreviewing}
                        className="flex size-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                        title={isPlaying ? 'Stop' : 'Preview'}
                      >
                        {isPreviewing ? (
                          <span className="size-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                        ) : isPlaying ? (
                          <Square className="size-3.5 fill-current" />
                        ) : (
                          <Play className="size-3.5 fill-current" />
                        )}
                      </button>
                      {isSelected && <Check className="size-4 text-primary" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-dashed">
        <CardContent className="py-4 flex gap-3">
          <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Voice changes are saved automatically and take effect on the next call.
            Preview voices before committing to ensure they match your brand.
          </p>
        </CardContent>
      </Card>

      {/* Confirmation bar */}
      {hasPendingChange && (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="flex-1 text-sm">
            <span className="font-medium">
              {voices.find(v => v.voice_id === selectedVoiceId)?.name ?? 'New voice'}
            </span>
            <span className="text-muted-foreground ml-2">selected — confirm to apply</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedVoiceId(agent.voice_id ?? '')}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="purple-glow">
            {isSaving ? 'Saving…' : 'Apply Voice'}
          </Button>
        </div>
      )}
    </div>
  )
}
