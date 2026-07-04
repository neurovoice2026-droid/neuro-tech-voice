'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic2, ArrowRight, ArrowLeft, Play, Pause, Search,
  CheckCircle2, MicOff, Loader2, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import type { ElevenLabsVoice } from '@/types'

// ─── Types & language config ─────────────────────────────────────────────────
interface Voice {
  voice_id: string
  name: string
  language: string       // display name, e.g. "Romanian"
  languageCode: string   // e.g. "ro"
  flag: string
  accent: string
  gender: 'Male' | 'Female' | 'Neutral'
  age: string
  description?: string
  preview_url?: string
  featured?: boolean
  owned?: boolean
  public_owner_id?: string // present → library voice, must be added on select
}

const LANGS = [
  { code: 'all', name: 'All languages', flag: '🌐' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
]
const LANG_MAP: Record<string, { code: string; name: string; flag: string }> =
  Object.fromEntries(LANGS.map((l) => [l.code, l]))

const GENDERS: Array<'All' | 'Female' | 'Male'> = ['All', 'Female', 'Male']

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s
}

function mapVoice(v: ElevenLabsVoice): Voice {
  const labels = (v.labels ?? {}) as Record<string, string>
  const code = (labels.language ?? 'en').toLowerCase()
  const lang = LANG_MAP[code]
  const genderRaw = (labels.gender ?? '').toLowerCase()
  const gender: Voice['gender'] = genderRaw.includes('female')
    ? 'Female'
    : genderRaw.includes('neutral')
      ? 'Neutral'
      : 'Male'
  const ageRaw = (labels.age ?? '').toLowerCase()
  const age = ageRaw.includes('old') || ageRaw.includes('mature')
    ? 'Mature'
    : ageRaw.includes('middle')
      ? 'Middle aged'
      : ageRaw.includes('young')
        ? 'Young'
        : ''
  const pub = (v as { public_owner_id?: string }).public_owner_id
  return {
    voice_id: v.voice_id,
    name: v.name.split(' - ')[0], // strip long marketing descriptors
    language: lang?.name ?? titleCase(code),
    languageCode: code,
    flag: lang?.flag ?? '🎙️',
    accent: titleCase(labels.accent ?? ''),
    gender,
    age,
    description: (v.description as string) ?? titleCase(labels.descriptive ?? labels.use_case ?? ''),
    preview_url: v.preview_url ?? undefined,
    featured: v.category === 'premade',
    owned: !pub,
    public_owner_id: pub,
  }
}

const PAGE_SIZE = 30

// ─── Voice card ───────────────────────────────────────────────────────────────
function VoiceCard({
  voice, selected, playing, onSelect, onTogglePlay,
}: {
  voice: Voice
  selected: boolean
  playing: boolean
  onSelect: () => void
  onTogglePlay: () => void
}) {
  const initials = voice.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 transition-all duration-200 cursor-pointer',
        selected
          ? 'border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10'
          : 'border-border hover:border-purple-200 hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      {selected && (
        <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" />
      )}

      <div className="flex items-center gap-3">
        <div className={cn(
          'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
          selected ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-indigo-600'
        )}>
          {initials || <Mic2 className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{voice.name}</p>
            {voice.owned && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Yours</span>
            )}
            {!voice.owned && voice.featured && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Popular</span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="text-sm leading-none">{voice.flag}</span>
            <span className="truncate">{voice.language}{voice.accent ? ` · ${voice.accent}` : ''}</span>
          </p>
        </div>
      </div>

      {voice.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{voice.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
          voice.gender === 'Female' ? 'bg-pink-50 text-pink-600' : voice.gender === 'Neutral' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600')}>
          {voice.gender}
        </span>
        {voice.age && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{voice.age}</span>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTogglePlay() }}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium transition-all',
          playing
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary'
        )}
      >
        {playing ? <><Pause className="h-3.5 w-3.5" />Playing…</> : <><Play className="h-3.5 w-3.5" />Preview</>}
      </button>
    </div>
  )
}

// ─── Step3Voice ────────────────────────────────────────────────────────────────
export function Step3Voice() {
  const { voice, setVoice, setStep } = useOnboardingStore()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [langCode, setLangCode] = useState('all')
  const [gender, setGender] = useState<'All' | 'Female' | 'Male'>('All')

  const [workspace, setWorkspace] = useState<Voice[]>([])
  const [library, setLibrary] = useState<Voice[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selected, setSelected] = useState<Voice | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Workspace voices (the account's own voices) — loaded once.
  useEffect(() => {
    let active = true
    fetch('/api/elevenlabs/voices')
      .then((r) => (r.ok ? r.json() : { voices: [] }))
      .then((d: { voices?: ElevenLabsVoice[] }) => {
        if (!active) return
        const mapped = (d.voices ?? []).map(mapVoice)
        setWorkspace(mapped)
        if (voice.voice_id) {
          setSelected((cur) => cur ?? mapped.find((v) => v.voice_id === voice.voice_id) ?? null)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [voice.voice_id])

  // Library voices — refetched whenever a filter/search changes (page 0).
  const fetchLibrary = useCallback(async (pageNum: number, replace: boolean) => {
    const params = new URLSearchParams({ page: String(pageNum) })
    if (debounced.length >= 2) params.set('search', debounced)
    if (langCode !== 'all') params.set('language', langCode)
    if (gender !== 'All') params.set('gender', gender.toLowerCase())

    if (replace) setLoading(true); else setLoadingMore(true)
    try {
      const res = await fetch(`/api/elevenlabs/voices/library?${params.toString()}`)
      const data = res.ok ? await res.json() : { voices: [], has_more: false }
      const mapped = (data.voices ?? []).map(mapVoice)
      setLibrary((prev) => (replace ? mapped : [...prev, ...mapped]))
      setHasMore(!!data.has_more)
    } catch {
      if (replace) setLibrary([])
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [debounced, langCode, gender])

  useEffect(() => {
    setPage(0)
    fetchLibrary(0, true)
  }, [fetchLibrary])

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchLibrary(next, false)
  }

  function togglePlay(v: Voice) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playingId === v.voice_id) { setPlayingId(null); return }
    if (!v.preview_url) { toast.info('No preview available for this voice'); return }
    const audio = new Audio(v.preview_url)
    audioRef.current = audio
    setPlayingId(v.voice_id)
    audio.addEventListener('ended', () => { setPlayingId(null); audioRef.current = null })
    audio.play().catch(() => { setPlayingId(null); toast.error('Could not play preview') })
  }

  // Workspace voices filtered client-side; library is already server-filtered.
  const workspaceFiltered = workspace.filter((v) => {
    const s = debounced.toLowerCase()
    const matchSearch = !s || v.name.toLowerCase().includes(s) || v.accent.toLowerCase().includes(s)
    const matchLang = langCode === 'all' || v.languageCode === langCode
    const matchGender = gender === 'All' || v.gender === gender
    return matchSearch && matchLang && matchGender
  })
  const seen = new Set(workspaceFiltered.map((v) => v.voice_id))
  const results = [...workspaceFiltered, ...library.filter((v) => !seen.has(v.voice_id))]

  async function handleContinue() {
    if (!selected) return
    let voiceId = selected.voice_id
    if (selected.public_owner_id) {
      setAdding(true)
      try {
        const res = await fetch('/api/elevenlabs/voices/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_owner_id: selected.public_owner_id, voice_id: selected.voice_id, name: selected.name }),
        })
        const data = await res.json()
        if (res.ok && data.voice_id) voiceId = data.voice_id
        else { toast.error(data.error ?? 'Could not add this voice'); setAdding(false); return }
      } catch { toast.error('Could not add this voice — try another'); setAdding(false); return }
      setAdding(false)
    }
    setVoice({ voice_id: voiceId, voice_name: selected.name, preview_url: selected.preview_url ?? '' })
    setStep(4)
  }

  const activeFilters = (langCode !== 'all' ? 1 : 0) + (gender !== 'All' ? 1 : 0) + (debounced ? 1 : 0)

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Mic2 className="h-7 w-7 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Choose your agent&apos;s voice</h2>
          <p className="mt-1 text-muted-foreground">
            Browse thousands of natural-sounding voices, preview and pick the perfect one.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-[70px] z-10 -mx-1 space-y-3 rounded-2xl border bg-white/90 p-3 backdrop-blur-md">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search voices by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 pr-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select value={langCode} onValueChange={(v) => v && setLangCode(v)}>
            <SelectTrigger className="h-10 sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
            {GENDERS.map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:flex-none',
                  gender === g ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {loading ? 'Loading voices…' : `${results.length}${hasMore ? '+' : ''} voice${results.length !== 1 ? 's' : ''}`}
          </p>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setLangCode('all'); setGender('All') }}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => <div key={i} className="h-[180px] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <MicOff className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No voices match your filters</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setLangCode('all'); setGender('All') }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => (
              <VoiceCard
                key={v.voice_id}
                voice={v}
                selected={selected?.voice_id === v.voice_id}
                playing={playingId === v.voice_id}
                onSelect={() => setSelected(v)}
                onTogglePlay={() => togglePlay(v)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Load more voices
              </Button>
            </div>
          )}
        </>
      )}

      {/* Sticky footer: selection + navigation */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {selected ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="truncate text-xs text-muted-foreground">{selected.flag} {selected.language}{selected.accent ? ` · ${selected.accent}` : ''}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a voice to continue</p>
          )}

          <div className="flex flex-shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
            </Button>
            <Button onClick={handleContinue} disabled={!selected || adding} className="purple-glow px-5">
              {adding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
