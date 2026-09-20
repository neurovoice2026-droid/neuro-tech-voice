'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, FileAudio, Loader2, Mic, Square, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { cn } from '@/lib/utils'
import { notifyVoicesChanged, useAccents } from '@/hooks/useVoices'
import type { Voice } from '@/types'
import { errorMessage, isAbort, postJson } from './api'
import {
  convertToWav,
  isRecordingSupported,
  microphoneErrorMessage,
  pickRecorderType,
  readLevel,
  recordingFormat,
} from './recording'
import { measureAudioDuration, requestUploadTicket, uploadToSignedUrl } from './upload'
import {
  acceptAttribute,
  CLONE_AUDIO_FORMATS,
  CLONE_MAX_BYTES,
  CLONE_MAX_SECONDS,
  CLONE_MIN_SECONDS,
  CLONE_NAME_MAX,
  consentStatement,
  formatBytes,
  GENDER_OPTIONS,
  languageOption,
  VOICE_LANGUAGES,
  type VoiceGender,
} from './voice-options'
import { sampleFor } from './voice-samples'

interface CloneVoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (voice: Voice) => void
  defaultLanguage?: string | null
}

interface Clip {
  blob: Blob
  url: string
  extension: string
  seconds: number | null
  source: 'recording' | 'file'
  label: string
}

type RecordState = 'idle' | 'requesting' | 'recording' | 'processing'
type Phase = null | 'uploading' | 'creating'

const AUTO_ACCENT = 'auto'
const FILE_EXTENSION = /\.(wav|wave|mp3|mpga|ogg|oga|opus|webm|weba|flac)$/i

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function extensionOf(file: File): string {
  const match = FILE_EXTENSION.exec(file.name)
  if (match) {
    const ext = match[1].toLowerCase()
    return ext === 'wave' ? 'wav' : ext === 'mpga' ? 'mp3' : ext === 'oga' || ext === 'opus' ? 'ogg' : ext === 'weba' ? 'webm' : ext
  }
  const fromType = file.type.split('/')[1]?.split(';')[0]
  return fromType === 'mpeg' ? 'mp3' : fromType === 'x-wav' || fromType === 'wave' ? 'wav' : fromType ?? 'wav'
}

export function CloneVoiceDialog({ open, onOpenChange, onCreated, defaultLanguage }: CloneVoiceDialogProps) {
  const idPrefix = useId()
  const [mode, setMode] = useState<'record' | 'upload'>('record')
  const [clip, setClip] = useState<Clip | null>(null)
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState<string>(languageOption(defaultLanguage)?.value ?? 'en')
  const [accent, setAccent] = useState<string>(AUTO_ACCENT)
  const [gender, setGender] = useState<VoiceGender | null>(null)
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState<Phase>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const meterRef = useRef<HTMLDivElement | null>(null)
  const startedAtRef = useRef(0)
  const discardRef = useRef(false)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { accents, isLoading: accentsLoading } = useAccents(language, { enabled: open })
  const trimmedName = name.trim()
  // Until the voice has a name, show the statement without the name clause (the
  // submitted text always carries the real name, as the API requires).
  const statement = trimmedName ? consentStatement(trimmedName) : consentStatement('').replace(' named ""', '')
  const busy = phase !== null
  const recordingSupported = typeof window === 'undefined' ? true : isRecordingSupported()

  const releaseMicrophone = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
  }, [])

  const replaceClip = useCallback((next: Clip | null) => {
    setClip((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    discardRef.current = true
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    recorderRef.current = null
    releaseMicrophone()
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    replaceClip(null)
    setRecordState('idle')
    setElapsed(0)
    setName('')
    setAccent(AUTO_ACCENT)
    setGender(null)
    setConsent(false)
    setPhase(null)
    setProgress(0)
    setError(null)
    setMode('record')
  }, [releaseMicrophone, replaceClip])

  // Release the microphone and object URLs when the dialog goes away.
  useEffect(() => () => reset(), [reset])

  useEffect(() => {
    if (open) setLanguage(languageOption(defaultLanguage)?.value ?? 'en')
  }, [open, defaultLanguage])

  function handleOpenChange(next: boolean) {
    // The clone is being created server-side; closing now would hide the result.
    if (!next && phase === 'creating') return
    if (!next) reset()
    onOpenChange(next)
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      setRecordState('processing')
      recorder.stop()
    }
  }

  async function startRecording() {
    setError(null)
    if (!isRecordingSupported()) {
      setError('Recording isn’t supported in this browser. Please upload a recording instead.')
      return
    }
    replaceClip(null)
    setRecordState('requesting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
    } catch (err) {
      setRecordState('idle')
      setError(microphoneErrorMessage(err))
      return
    }
    streamRef.current = stream
    discardRef.current = false

    const type = pickRecorderType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    } catch {
      releaseMicrophone()
      setRecordState('idle')
      setError('Recording isn’t supported in this browser. Please upload a recording instead.')
      return
    }
    recorderRef.current = recorder
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = async () => {
      const seconds = (performance.now() - startedAtRef.current) / 1000
      releaseMicrophone()
      recorderRef.current = null
      if (discardRef.current) return
      if (seconds < CLONE_MIN_SECONDS) {
        setRecordState('idle')
        setElapsed(0)
        setError(`That was ${Math.floor(seconds)} seconds. Please record at least ${CLONE_MIN_SECONDS} seconds of speech.`)
        return
      }
      try {
        const recorded = new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' })
        const format = recordingFormat(recorded.type)
        const usable = format === 'webm' || format === 'ogg'
        const blob = usable ? recorded : await convertToWav(recorded)
        const extension = usable ? format : 'wav'
        replaceClip({
          blob,
          url: URL.createObjectURL(blob),
          extension,
          seconds,
          source: 'recording',
          label: `Recording · ${formatClock(seconds)}`,
        })
      } catch {
        setError('We couldn’t process the recording. Please try again, or upload a file instead.')
      } finally {
        setRecordState('idle')
      }
    }

    // Level meter, drawn outside React to avoid re-rendering 60 times a second.
    try {
      const context = new AudioContext()
      audioContextRef.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(stream).connect(analyser)
      const buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4))
      const draw = () => {
        const level = readLevel(analyser, buffer)
        if (meterRef.current) meterRef.current.style.transform = `scaleX(${Math.max(0.02, level)})`
        frameRef.current = requestAnimationFrame(draw)
      }
      draw()
    } catch {
      // The meter is optional; recording works without it.
    }

    startedAtRef.current = performance.now()
    setElapsed(0)
    timerRef.current = setInterval(() => {
      const seconds = (performance.now() - startedAtRef.current) / 1000
      setElapsed(seconds)
      if (seconds >= CLONE_MAX_SECONDS) stopRecording()
    }, 200)
    recorder.start(250)
    setRecordState('recording')
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return
    setError(null)
    const looksAudio = FILE_EXTENSION.test(file.name) || /^audio\/(wav|x-wav|wave|mpeg|mp3|ogg|webm|flac|x-flac)/.test(file.type)
    if (!looksAudio) {
      setError('Please choose a WAV, MP3, OGG, WebM or FLAC file.')
      return
    }
    if (file.size > CLONE_MAX_BYTES) {
      setError(`This file is ${formatBytes(file.size)}. Recordings can be up to ${formatBytes(CLONE_MAX_BYTES)}.`)
      return
    }
    const seconds = await measureAudioDuration(file)
    if (seconds !== null && seconds < CLONE_MIN_SECONDS) {
      setError(`This recording is ${Math.floor(seconds)} seconds long. Please use at least ${CLONE_MIN_SECONDS} seconds of speech.`)
      return
    }
    replaceClip({
      blob: file,
      url: URL.createObjectURL(file),
      extension: extensionOf(file),
      seconds,
      source: 'file',
      label: `${file.name} · ${formatBytes(file.size)}${seconds ? ` · ${formatClock(seconds)}` : ''}`,
    })
    if (!name.trim()) setName(file.name.replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, CLONE_NAME_MAX))
  }

  async function submit() {
    if (!clip || !trimmedName || !consent || busy) return
    setError(null)
    const controller = new AbortController()
    uploadAbortRef.current = controller
    try {
      setPhase('uploading')
      setProgress(0)
      const fileName = `recording.${clip.extension}`
      const ticket = await requestUploadTicket('/api/voices/clone/upload-url', clip.blob, fileName)
      await uploadToSignedUrl({ ticket, file: clip.blob, fileName, onProgress: setProgress, signal: controller.signal })
      setPhase('creating')
      const { voice } = await postJson<{ voice: Voice }>('/api/voices/clone', {
        storage_path: ticket.path,
        name: trimmedName,
        language,
        accent: accent === AUTO_ACCENT ? null : accent,
        gender,
        consent: true,
        consent_statement: consentStatement(trimmedName),
      })
      toast.success(`“${voice.name}” is ready to use`)
      notifyVoicesChanged()
      onCreated?.(voice)
      reset()
      onOpenChange(false)
    } catch (err) {
      if (isAbort(err)) return
      setError(errorMessage(err, 'We couldn’t create the voice. Please try again.'))
      setPhase(null)
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null
    }
  }

  const selectedLanguage = languageOption(language)
  const recording = recordState === 'recording'
  const minReached = elapsed >= CLONE_MIN_SECONDS
  const canSubmit = Boolean(clip && trimmedName && consent && !busy && recordState === 'idle')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clone a voice</DialogTitle>
          <DialogDescription>
            Record or upload {CLONE_MIN_SECONDS}–{CLONE_MAX_SECONDS} seconds of one person speaking clearly in a quiet room. The
            voice stays private to your business.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5">
          <Tabs value={mode} onValueChange={(value) => !busy && recordState === 'idle' && setMode(value as 'record' | 'upload')}>
            <TabsList className="w-full">
              <TabsTrigger value="record" disabled={busy || recording}>
                <Mic aria-hidden="true" /> Record
              </TabsTrigger>
              <TabsTrigger value="upload" disabled={busy || recording}>
                <Upload aria-hidden="true" /> Upload a file
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="pt-3">
              {!clip && (
                <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">
                    Read this, then keep talking naturally about your business until the bar passes {CLONE_MIN_SECONDS} seconds:
                  </p>
                  <p lang={language} className="text-sm leading-relaxed text-foreground">
                    “{sampleFor(language).text}”
                  </p>

                  {recording || recordState === 'processing' ? (
                    <div className="space-y-2" aria-live="polite">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
                          {recordState === 'processing' ? 'Finishing…' : 'Recording'}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatClock(elapsed)} / {formatClock(CLONE_MAX_SECONDS)}
                        </span>
                      </div>
                      <Progress value={Math.min(100, (elapsed / CLONE_MAX_SECONDS) * 100)} aria-label="Recording length" />
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div ref={meterRef} className="h-full origin-left scale-x-[0.02] rounded-full bg-emerald-500 transition-transform duration-75" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {minReached
                          ? 'That’s enough to create the voice. Keep going for a closer match, or stop now.'
                          : `Keep talking: ${Math.ceil(CLONE_MIN_SECONDS - elapsed)} more seconds needed.`}
                      </p>
                      <Button type="button" variant="outline" onClick={stopRecording} disabled={recordState === 'processing'} className="w-full">
                        <Square className="fill-current" aria-hidden="true" /> Stop recording
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={startRecording}
                      disabled={busy || recordState === 'requesting' || !recordingSupported}
                      className="w-full"
                    >
                      {recordState === 'requesting' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mic aria-hidden="true" />}
                      {recordState === 'requesting' ? 'Waiting for microphone…' : 'Start recording'}
                    </Button>
                  )}
                  {!recordingSupported && (
                    <p className="text-xs text-muted-foreground">This browser can’t record audio. Use “Upload a file” instead.</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload" className="pt-3">
              {!clip && (
                <label
                  htmlFor={`${idPrefix}-file`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    void acceptFile(event.dataTransfer.files[0])
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50',
                    dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  )}
                >
                  <FileAudio className="size-8 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">Drop a recording here or choose a file</span>
                  <span className="text-xs text-muted-foreground">
                    WAV, MP3, OGG, WebM or FLAC · up to {formatBytes(CLONE_MAX_BYTES)} · at least {CLONE_MIN_SECONDS} seconds
                  </span>
                  <input
                    ref={fileInputRef}
                    id={`${idPrefix}-file`}
                    type="file"
                    accept={acceptAttribute(CLONE_AUDIO_FORMATS)}
                    className="sr-only"
                    onChange={(event) => {
                      void acceptFile(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
              )}
            </TabsContent>
          </Tabs>

          {clip && (
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-foreground">{clip.label}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    replaceClip(null)
                    setError(null)
                  }}
                >
                  <Trash2 aria-hidden="true" /> {clip.source === 'recording' ? 'Record again' : 'Remove'}
                </Button>
              </div>
              <audio controls src={clip.url} className="h-9 w-full" aria-label="Listen to your recording" />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${idPrefix}-name`}>Voice name</Label>
                <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
                  {name.length}/{CLONE_NAME_MAX}
                </span>
              </div>
              <Input
                id={`${idPrefix}-name`}
                value={name}
                maxLength={CLONE_NAME_MAX}
                disabled={busy}
                onChange={(event) => {
                  setName(event.target.value)
                  setConsent(false)
                }}
                placeholder="e.g. Maria at the front desk"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-language`}>Language spoken</Label>
              <Select
                value={language}
                onValueChange={(value) => {
                  if (!value) return
                  setLanguage(String(value))
                  setAccent(AUTO_ACCENT)
                }}
                disabled={busy}
              >
                <SelectTrigger id={`${idPrefix}-language`} className="h-9 w-full">
                  <SelectValue>
                    {() =>
                      selectedLanguage ? (
                        <span className="flex items-center gap-2">
                          <FlagIcon country={selectedLanguage.country} />
                          {selectedLanguage.label}
                        </span>
                      ) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VOICE_LANGUAGES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <FlagIcon country={option.country} />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-accent`}>Accent (optional)</Label>
              <Select value={accent} onValueChange={(value) => value && setAccent(String(value))} disabled={busy || accentsLoading}>
                <SelectTrigger id={`${idPrefix}-accent`} className="h-9 w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === AUTO_ACCENT ? 'Detect from recording' : accents.find((a) => a.id === value)?.name ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_ACCENT}>Detect from recording</SelectItem>
                  {accents.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <span id={`${idPrefix}-gender`} className="text-sm font-medium text-foreground">
                Voice type (optional)
              </span>
              <div role="group" aria-labelledby={`${idPrefix}-gender`} className="flex flex-wrap gap-1.5">
                {[{ value: null, label: 'Not set' }, ...GENDER_OPTIONS].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    disabled={busy}
                    aria-pressed={gender === option.value}
                    onClick={() => setGender(option.value as VoiceGender | null)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
                      gender === option.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Used to pick a matching backup voice if our main voice service is ever unavailable.</p>
            </div>
          </div>

          <label className={cn('flex items-start gap-3 rounded-xl border p-3', !trimmedName && 'opacity-60')}>
            <Checkbox
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              disabled={!trimmedName || busy}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-foreground">{statement}</span>
          </label>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {phase && (
            <div className="space-y-1.5" aria-live="polite">
              <p className="text-xs text-muted-foreground">
                {phase === 'uploading' ? `Uploading recording… ${Math.round(progress * 100)}%` : 'Creating your voice… this can take up to a minute.'}
              </p>
              <Progress value={phase === 'uploading' ? Math.round(progress * 100) : null} aria-label="Clone progress" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={phase === 'creating'}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {phase === 'uploading' ? 'Uploading…' : phase === 'creating' ? 'Creating…' : 'Create voice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
