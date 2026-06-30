'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Mic2, ArrowRight, ArrowLeft, Play, Square, Search,
  CheckCircle2, MicOff, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import type { ElevenLabsVoice } from '@/types'

// ─── Voice shape used by the picker ──────────────────────────────────────────
interface DemoVoice {
  voice_id: string
  name: string
  language: string
  flag: string
  accent: string
  gender: 'Male' | 'Female'
  age: 'Young' | 'Middle Aged' | 'Mature'
  style: string
  featured?: boolean
  preview_url?: string
  /** Present when the voice comes from the shared library (must be added on use). */
  public_owner_id?: string
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Map a real ElevenLabs voice into the picker shape, deriving display metadata
// from its labels. This is what makes the selected voice_id a REAL voice id.
function mapVoice(v: ElevenLabsVoice): DemoVoice {
  const labels = v.labels ?? {}
  const gender: 'Male' | 'Female' = (labels.gender ?? '').toLowerCase().includes('female') ? 'Female' : 'Male'
  const ageRaw = (labels.age ?? '').toLowerCase()
  const age: DemoVoice['age'] = ageRaw.includes('old') || ageRaw.includes('mature')
    ? 'Mature'
    : ageRaw.includes('middle')
      ? 'Middle Aged'
      : 'Young'
  return {
    voice_id: v.voice_id,
    name: v.name,
    language: titleCase(labels.language ?? 'English'),
    flag: '🎙️',
    accent: titleCase(labels.accent ?? labels.descriptive ?? 'Neutral'),
    gender,
    age,
    style: titleCase(labels.use_case ?? labels.description ?? 'Conversational'),
    featured: v.category === 'premade',
    preview_url: v.preview_url ?? undefined,
    public_owner_id: (v as { public_owner_id?: string }).public_owner_id,
  }
}

const DEMO_VOICES: DemoVoice[] = [
  // English
  { voice_id: 'rachel',   name: 'Rachel',    language: 'English',    flag: '🇺🇸', accent: 'American',    gender: 'Female', age: 'Young',       style: 'Conversational', featured: true },
  { voice_id: 'drew',     name: 'Drew',      language: 'English',    flag: '🇺🇸', accent: 'American',    gender: 'Male',   age: 'Middle Aged', style: 'Well-rounded',   featured: true },
  { voice_id: 'bella',    name: 'Bella',     language: 'English',    flag: '🇺🇸', accent: 'American',    gender: 'Female', age: 'Young',       style: 'Soft' },
  { voice_id: 'thomas',   name: 'Thomas',    language: 'English',    flag: '🇺🇸', accent: 'American',    gender: 'Male',   age: 'Young',       style: 'Calm' },
  { voice_id: 'emily',    name: 'Emily',     language: 'English',    flag: '🇺🇸', accent: 'American',    gender: 'Female', age: 'Young',       style: 'Warm' },
  { voice_id: 'clyde',    name: 'Clyde',     language: 'English',    flag: '🇺🇸', accent: 'American',    gender: 'Male',   age: 'Mature',      style: 'Grounded' },
  { voice_id: 'dave',     name: 'Dave',      language: 'English',    flag: '🇬🇧', accent: 'British',     gender: 'Male',   age: 'Young',       style: 'Conversational', featured: true },
  { voice_id: 'grace',    name: 'Grace',     language: 'English',    flag: '🇬🇧', accent: 'British',     gender: 'Female', age: 'Young',       style: 'Elegant' },
  { voice_id: 'fin',      name: 'Fin',       language: 'English',    flag: '🇮🇪', accent: 'Irish',       gender: 'Male',   age: 'Mature',      style: 'Storyteller' },
  { voice_id: 'charlie',  name: 'Charlie',   language: 'English',    flag: '🇦🇺', accent: 'Australian',  gender: 'Male',   age: 'Middle Aged', style: 'Casual' },
  { voice_id: 'olivia',   name: 'Olivia',    language: 'English',    flag: '🇦🇺', accent: 'Australian',  gender: 'Female', age: 'Young',       style: 'Friendly' },
  // Romanian
  { voice_id: 'elena',    name: 'Elena',     language: 'Romanian',   flag: '🇷🇴', accent: 'Standard',    gender: 'Female', age: 'Young',       style: 'Professional', featured: true },
  { voice_id: 'andrei',   name: 'Andrei',    language: 'Romanian',   flag: '🇷🇴', accent: 'Standard',    gender: 'Male',   age: 'Middle Aged', style: 'Friendly' },
  { voice_id: 'maria',    name: 'Maria',     language: 'Romanian',   flag: '🇷🇴', accent: 'Moldovan',    gender: 'Female', age: 'Middle Aged', style: 'Warm' },
  // Spanish
  { voice_id: 'lucia',    name: 'Lucía',     language: 'Spanish',    flag: '🇪🇸', accent: 'European',    gender: 'Female', age: 'Young',       style: 'Warm', featured: true },
  { voice_id: 'miguel',   name: 'Miguel',    language: 'Spanish',    flag: '🇲🇽', accent: 'Mexican',     gender: 'Male',   age: 'Middle Aged', style: 'Professional' },
  { voice_id: 'valeria',  name: 'Valeria',   language: 'Spanish',    flag: '🇦🇷', accent: 'Argentinian', gender: 'Female', age: 'Young',       style: 'Expressive' },
  // French
  { voice_id: 'camille',  name: 'Camille',   language: 'French',     flag: '🇫🇷', accent: 'Parisian',    gender: 'Female', age: 'Young',       style: 'Elegant', featured: true },
  { voice_id: 'pierre',   name: 'Pierre',    language: 'French',     flag: '🇫🇷', accent: 'Parisian',    gender: 'Male',   age: 'Middle Aged', style: 'Sophisticated' },
  // German
  { voice_id: 'hans',     name: 'Hans',      language: 'German',     flag: '🇩🇪', accent: 'Standard',    gender: 'Male',   age: 'Middle Aged', style: 'Authoritative', featured: true },
  { voice_id: 'greta',    name: 'Greta',     language: 'German',     flag: '🇩🇪', accent: 'Bavarian',    gender: 'Female', age: 'Young',       style: 'Professional' },
  // Italian
  { voice_id: 'sofia',    name: 'Sofia',     language: 'Italian',    flag: '🇮🇹', accent: 'Roman',       gender: 'Female', age: 'Young',       style: 'Expressive', featured: true },
  { voice_id: 'marco',    name: 'Marco',     language: 'Italian',    flag: '🇮🇹', accent: 'Milanese',    gender: 'Male',   age: 'Middle Aged', style: 'Warm' },
  // Portuguese
  { voice_id: 'ana',      name: 'Ana',       language: 'Portuguese', flag: '🇧🇷', accent: 'Brazilian',   gender: 'Female', age: 'Young',       style: 'Friendly', featured: true },
  { voice_id: 'joao',     name: 'João',      language: 'Portuguese', flag: '🇵🇹', accent: 'European',    gender: 'Male',   age: 'Middle Aged', style: 'Formal' },
  // Japanese
  { voice_id: 'yuki',     name: 'Yuki',      language: 'Japanese',   flag: '🇯🇵', accent: 'Tokyo',       gender: 'Female', age: 'Young',       style: 'Calm', featured: true },
  { voice_id: 'kenji',    name: 'Kenji',     language: 'Japanese',   flag: '🇯🇵', accent: 'Osaka',       gender: 'Male',   age: 'Middle Aged', style: 'Professional' },
  // Korean
  { voice_id: 'jiyeon',   name: 'Ji-yeon',   language: 'Korean',     flag: '🇰🇷', accent: 'Seoul',       gender: 'Female', age: 'Young',       style: 'Friendly', featured: true },
  { voice_id: 'minho',    name: 'Min-ho',    language: 'Korean',     flag: '🇰🇷', accent: 'Seoul',       gender: 'Male',   age: 'Young',       style: 'Professional' },
  // Arabic
  { voice_id: 'omar',     name: 'Omar',      language: 'Arabic',     flag: '🇸🇦', accent: 'Gulf',        gender: 'Male',   age: 'Middle Aged', style: 'Formal', featured: true },
  { voice_id: 'layla',    name: 'Layla',     language: 'Arabic',     flag: '🇦🇪', accent: 'Levantine',   gender: 'Female', age: 'Young',       style: 'Warm' },
  // Polish
  { voice_id: 'zofia',    name: 'Zofia',     language: 'Polish',     flag: '🇵🇱', accent: 'Warsaw',      gender: 'Female', age: 'Young',       style: 'Friendly' },
  { voice_id: 'radoslaw', name: 'Radosław',  language: 'Polish',     flag: '🇵🇱', accent: 'Standard',    gender: 'Male',   age: 'Middle Aged', style: 'Professional' },
  // Dutch
  { voice_id: 'lars',     name: 'Lars',      language: 'Dutch',      flag: '🇳🇱', accent: 'Standard',    gender: 'Male',   age: 'Middle Aged', style: 'Professional' },
  { voice_id: 'femke',    name: 'Femke',     language: 'Dutch',      flag: '🇳🇱', accent: 'Amsterdam',   gender: 'Female', age: 'Young',       style: 'Friendly' },
]

const LANGUAGES = ['All', 'English', 'Romanian', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Arabic', 'Polish', 'Dutch']
const GENDERS: Array<'All' | 'Male' | 'Female'> = ['All', 'Female', 'Male']
const AGES: Array<'All' | 'Young' | 'Middle Aged' | 'Mature'> = ['All', 'Young', 'Middle Aged', 'Mature']

// ─── Waveform bars ─────────────────────────────────────────────────────────────
const WAVE_HEIGHTS = [40, 70, 55, 90, 45, 75, 60, 85, 50, 65]

function WaveAnimation() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-primary"
          style={{
            height: `${h}%`,
            animation: `waveBar 0.8s ease-in-out ${i * 0.08}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

// ─── VoiceCard ─────────────────────────────────────────────────────────────────
interface VoiceCardProps {
  voice: DemoVoice
  isSelected: boolean
  isPlaying: boolean
  playingProgress: number
  onSelect: () => void
  onTogglePlay: () => void
}

function VoiceCard({ voice, isSelected, isPlaying, playingProgress, onSelect, onTogglePlay }: VoiceCardProps) {
  const initials = voice.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const genderColor = voice.gender === 'Female' ? 'text-pink-600 bg-pink-50' : 'text-blue-600 bg-blue-50'

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-150',
        isSelected
          ? 'border-primary bg-purple-50 ring-2 ring-primary ring-offset-1 shadow-md'
          : 'border-border hover:border-purple-200 hover:bg-purple-50/40 hover:shadow-sm'
      )}
    >
      {/* Audio progress bar */}
      {isPlaying && (
        <div className="absolute left-0 top-0 h-0.5 w-full bg-purple-100">
          <div className="h-full bg-primary transition-all duration-200" style={{ width: `${playingProgress}%` }} />
        </div>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-purple-100 text-purple-700'
              )}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground leading-tight">{voice.name}</p>
                {voice.featured && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                    Popular
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm leading-none">{voice.flag}</span>
                <span className="text-xs text-muted-foreground">{voice.accent}</span>
              </div>
            </div>
          </div>
          {isSelected && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', genderColor)}>
            {voice.gender}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {voice.age}
          </span>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            {voice.style}
          </span>
        </div>

        {/* Play button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePlay() }}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-all',
            isPlaying
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-primary'
          )}
        >
          {isPlaying ? (
            <><WaveAnimation /><span className="ml-1">Playing...</span><Square className="h-3 w-3" /></>
          ) : (
            <><Play className="h-3 w-3" />Preview voice</>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Step3Voice ────────────────────────────────────────────────────────────────
export function Step3Voice() {
  const { voice, setVoice, setStep } = useOnboardingStore()
  const [search, setSearch]             = useState('')
  const [langFilter, setLangFilter]     = useState('All')
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All')
  const [ageFilter, setAgeFilter]       = useState<'All' | 'Young' | 'Middle Aged' | 'Mature'>('All')
  const [voices, setVoices] = useState<DemoVoice[]>(DEMO_VOICES)
  const [libraryVoices, setLibraryVoices] = useState<DemoVoice[]>([])
  const [libLoading, setLibLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<DemoVoice | null>(
    voice.voice_id ? DEMO_VOICES.find((v) => v.voice_id === voice.voice_id) ?? null : null
  )
  const [playingId, setPlayingId]         = useState<string | null>(null)
  const [playingProgress, setPlayingProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load real ElevenLabs voices; fall back to the bundled list only when
  // ElevenLabs isn't configured (demo mode, where no real agent is created).
  useEffect(() => {
    let active = true
    fetch('/api/elevenlabs/voices')
      .then((r) => (r.ok ? r.json() : { voices: [] }))
      .then((d: { voices?: ElevenLabsVoice[] }) => {
        if (!active) return
        const mapped = (d.voices ?? []).map(mapVoice)
        if (mapped.length > 0) {
          setVoices(mapped)
          setSelectedVoice((cur) =>
            cur ?? (voice.voice_id ? mapped.find((v) => v.voice_id === voice.voice_id) ?? null : null)
          )
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [voice.voice_id])

  // Browse the full ElevenLabs shared library (thousands of voices): a popular
  // page by default, and search results as the user types. This guarantees a
  // rich list even on a brand-new account with no custom voices.
  useEffect(() => {
    let active = true
    const q = search.trim()
    const url = q.length >= 2
      ? `/api/elevenlabs/voices/library?search=${encodeURIComponent(q)}`
      : '/api/elevenlabs/voices/library'
    setLibLoading(true)
    const t = setTimeout(() => {
      fetch(url)
        .then((r) => (r.ok ? r.json() : { voices: [] }))
        .then((d: { voices?: ElevenLabsVoice[] }) => {
          if (active) setLibraryVoices((d.voices ?? []).map(mapVoice))
        })
        .catch(() => {})
        .finally(() => { if (active) setLibLoading(false) })
    }, q ? 400 : 0)
    return () => { active = false; clearTimeout(t) }
  }, [search])

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  function togglePlay(v: DemoVoice) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }

    if (playingId === v.voice_id) {
      setPlayingId(null)
      setPlayingProgress(0)
      return
    }

    setPlayingId(v.voice_id)
    setPlayingProgress(0)

    // Real preview audio when ElevenLabs provides a URL.
    if (v.preview_url) {
      const audio = new Audio(v.preview_url)
      audioRef.current = audio
      audio.addEventListener('timeupdate', () => {
        setPlayingProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
      })
      audio.addEventListener('ended', () => {
        setPlayingId(null); setPlayingProgress(0); audioRef.current = null
      })
      audio.play().catch(() => { setPlayingId(null); setPlayingProgress(0) })
      return
    }

    // Fallback progress animation when there's no preview audio.
    let progress = 0
    intervalRef.current = setInterval(() => {
      progress += 2
      setPlayingProgress(progress)
      if (progress >= 100) {
        clearInterval(intervalRef.current!)
        setPlayingId(null)
        setPlayingProgress(0)
      }
    }, 100)
  }

  const workspaceFiltered = voices.filter((v) => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.accent.toLowerCase().includes(search.toLowerCase())
    const matchLang   = langFilter === 'All' || v.language === langFilter
    const matchGender = genderFilter === 'All' || v.gender === genderFilter
    const matchAge    = ageFilter === 'All' || v.age === ageFilter
    return matchSearch && matchLang && matchGender && matchAge
  })
  // Merge in shared-library matches (already server-filtered by the search term).
  const seen = new Set(workspaceFiltered.map((v) => v.voice_id))
  const filtered = [
    ...workspaceFiltered,
    ...libraryVoices.filter((v) => {
      if (seen.has(v.voice_id)) return false
      const matchLang   = langFilter === 'All' || v.language === langFilter
      const matchGender = genderFilter === 'All' || v.gender === genderFilter
      const matchAge    = ageFilter === 'All' || v.age === ageFilter
      return matchLang && matchGender && matchAge
    }),
  ]

  async function handleContinue() {
    if (!selectedVoice) return
    let voiceId = selectedVoice.voice_id

    // Library voices must be added to the workspace before an agent can use them.
    if (selectedVoice.public_owner_id) {
      setAdding(true)
      try {
        const res = await fetch('/api/elevenlabs/voices/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_owner_id: selectedVoice.public_owner_id,
            voice_id: selectedVoice.voice_id,
            name: selectedVoice.name,
          }),
        })
        const data = await res.json()
        if (res.ok && data.voice_id) {
          voiceId = data.voice_id
        } else {
          toast.error(data.error ?? 'Could not add this voice to your account')
          setAdding(false)
          return
        }
      } catch {
        toast.error('Could not add this voice — try another one')
        setAdding(false)
        return
      }
      setAdding(false)
    }

    setVoice({
      voice_id: voiceId,
      voice_name: selectedVoice.name,
      preview_url: selectedVoice.preview_url ?? '',
    })
    setStep(4)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Mic2 className="h-7 w-7 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Choose your agent&apos;s voice</h2>
          <p className="mt-1 text-muted-foreground">
            {voices.length}+ voices across multiple languages — preview before selecting
          </p>
        </div>
      </div>

      {/* Language tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => setLangFilter(lang)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
              langFilter === lang
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-white text-muted-foreground hover:border-purple-300 hover:text-foreground'
            )}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Search + gender + age filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search voices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
          {GENDERS.map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                genderFilter === g ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
          {AGES.map((a) => (
            <button
              key={a}
              onClick={() => setAgeFilter(a)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                ageFilter === a ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {libLoading && filtered.length === 0
          ? 'Loading voices…'
          : `${filtered.length} voice${filtered.length !== 1 ? 's' : ''} found`}
      </p>

      {/* Voice grid */}
      {filtered.length === 0 ? (
        libLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
            <MicOff className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No voices match your filters</p>
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setLangFilter('All'); setGenderFilter('All'); setAgeFilter('All') }}>
              Clear all filters
            </Button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <VoiceCard
              key={v.voice_id}
              voice={v}
              isSelected={selectedVoice?.voice_id === v.voice_id}
              isPlaying={playingId === v.voice_id}
              playingProgress={playingId === v.voice_id ? playingProgress : 0}
              onSelect={() => setSelectedVoice(v)}
              onTogglePlay={() => togglePlay(v)}
            />
          ))}
        </div>
      )}

      {/* Selected voice banner */}
      {selectedVoice && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-purple-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {selectedVoice.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedVoice.flag} {selectedVoice.language} · {selectedVoice.accent} · {selectedVoice.gender}
              </p>
            </div>
          </div>
          <button onClick={() => setSelectedVoice(null)} className="text-xs text-muted-foreground hover:text-foreground">
            Change
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedVoice || adding}
          className="purple-glow px-6"
          title={!selectedVoice ? 'Please select a voice to continue' : undefined}
        >
          {adding ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding voice…</>
          ) : (
            <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </div>
    </div>
  )
}
