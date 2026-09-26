'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, Copy, Download, FileAudio, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/EmptyState'
import { errorMessage, isAbort, toVoiceApiError, VoiceApiError } from '@/components/voice/api'
import { LanguageSelect } from '@/components/voice/LanguageSelect'
import { measureAudioDuration, requestUploadTicket, uploadToSignedUrl } from '@/components/voice/upload'
import { acceptAttribute, formatBytes, languageLabel, STT_AUDIO_FORMATS, STT_MAX_BYTES } from '@/components/voice/voice-options'
import { baseFileName, clockLabel, toPlainText, toSrt, type TranscriptWord } from '@/app/(dashboard)/voice-lab/_lib/transcript'
import { cn } from '@/lib/utils'
import { QuotaMeter } from './QuotaMeter'
import type { VoiceLabUsage } from './use-voice-lab-usage'

interface SpeechToTextPanelProps {
  defaultLanguage: string
  usage: VoiceLabUsage | null
  /** Loading the allowance failed (the page shows why). */
  usageUnavailable?: boolean
  onQuotaHeaders: (headers: Headers) => void
}

interface Transcript {
  text: string
  words: TranscriptWord[]
  duration: number
  language: string
  fileName: string
}

type Phase = null | 'uploading' | 'transcribing'

const EXTENSIONS = /\.(wav|wave|mp3|m4a|mp4|ogg|oga|opus|webm|flac)$/i

function download(content: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SpeechToTextPanel({ defaultLanguage, usage, usageUnavailable = false, onQuotaHeaders }: SpeechToTextPanelProps) {
  const ids = useId()
  const [language, setLanguage] = useState(defaultLanguage)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<VoiceApiError | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [showTimings, setShowTimings] = useState(false)
  // A file already uploaded for this selection, reused by "Try again" after a temporary failure.
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    if (!fileUrl) return
    return () => URL.revokeObjectURL(fileUrl)
  }, [fileUrl])

  const remainingSeconds = usage?.stt.remaining ?? null
  const tooLongForQuota = duration !== null && remainingSeconds !== null && duration > remainingSeconds
  const configured = usage?.configured ?? true
  const busy = phase !== null
  const canTranscribe = Boolean(file && !busy && !tooLongForQuota && configured && (remainingSeconds === null || remainingSeconds > 0))

  async function chooseFile(next: File | undefined) {
    if (!next || busy) return
    setError(null)
    if (!EXTENSIONS.test(next.name) && !next.type.startsWith('audio/')) {
      setError(new VoiceApiError(415, 'unsupported_audio_format', 'Please choose a WAV, MP3, M4A, OGG, WebM or FLAC file.'))
      return
    }
    if (next.size > STT_MAX_BYTES) {
      setError(new VoiceApiError(413, 'file_too_large', `This file is ${formatBytes(next.size)}. Files can be up to ${formatBytes(STT_MAX_BYTES)}.`))
      return
    }
    setFile(next)
    setFileUrl(URL.createObjectURL(next))
    setUploadedPath(null)
    setDuration(await measureAudioDuration(next))
  }

  function clearFile() {
    setFile(null)
    setFileUrl(null)
    setDuration(null)
    setUploadedPath(null)
    setError(null)
  }

  async function transcribe() {
    if (!file || !canTranscribe) return
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      let storagePath = uploadedPath
      if (!storagePath) {
        setPhase('uploading')
        setProgress(0)
        const ticket = await requestUploadTicket('/api/voice-lab/stt/upload-url', file, file.name)
        await uploadToSignedUrl({ ticket, file, fileName: file.name, onProgress: setProgress, signal: controller.signal })
        storagePath = ticket.path
        setUploadedPath(storagePath)
      }
      setPhase('transcribing')
      const res = await fetch('/api/voice-lab/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath, language, duration_hint: duration }),
        signal: controller.signal,
      })
      onQuotaHeaders(res.headers)
      if (!res.ok) {
        const apiError = await toVoiceApiError(res)
        // The server keeps the upload only after a temporary provider problem.
        if (apiError.status < 500) setUploadedPath(null)
        throw apiError
      }
      const data = (await res.json()) as Omit<Transcript, 'fileName'>
      setTranscript({ ...data, fileName: file.name })
      setUploadedPath(null)
      if (!data.text.trim()) toast.info('No speech was found in this file.')
    } catch (err) {
      if (isAbort(err)) return
      const apiError = err instanceof VoiceApiError ? err : new VoiceApiError(0, 'unknown', errorMessage(err))
      setError(apiError)
    } finally {
      setPhase(null)
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function copyTranscript() {
    if (!transcript) return
    try {
      await navigator.clipboard.writeText(transcript.text)
      toast.success('Transcript copied')
    } catch {
      toast.error('Your browser didn’t allow copying. Select the text and copy it instead.')
    }
  }

  function seek(seconds: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    void audio.play().catch(() => undefined)
  }

  const retryable = error !== null && error.status >= 500 && uploadedPath !== null

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audio file</CardTitle>
            <CardDescription>Turn a recording, voicemail or meeting into text with word timings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-language`}>Language spoken</Label>
              <LanguageSelect id={`${ids}-language`} value={language} onChange={setLanguage} disabled={busy} />
            </div>

            {!file ? (
              <label
                htmlFor={`${ids}-file`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  void chooseFile(event.dataTransfer.files[0])
                }}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50',
                  dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}
              >
                <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">Drop an audio file here or choose one</span>
                <span className="text-xs text-muted-foreground">WAV, MP3, M4A, OGG, WebM or FLAC · up to {formatBytes(STT_MAX_BYTES)}</span>
                <input
                  id={`${ids}-file`}
                  type="file"
                  accept={acceptAttribute(STT_AUDIO_FORMATS)}
                  className="sr-only"
                  onChange={(event) => {
                    void chooseFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
            ) : (
              <div className="space-y-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileAudio className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                        {duration !== null && ` · ${clockLabel(duration)}`}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={clearFile} disabled={busy} aria-label="Remove file">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                {fileUrl && <audio ref={audioRef} controls src={fileUrl} className="h-9 w-full" aria-label={`Play ${file.name}`} />}
                {tooLongForQuota && (
                  <p className="text-xs text-destructive">
                    This recording is longer than the {Math.floor((remainingSeconds ?? 0) / 60)} minutes of transcription you have left.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{error.message}</span>
              </div>
            )}

            {phase && (
              <div className="space-y-1.5" aria-live="polite">
                <p className="text-xs text-muted-foreground">
                  {phase === 'uploading'
                    ? `Uploading… ${Math.round(progress * 100)}%`
                    : 'Transcribing… longer recordings can take up to a minute.'}
                </p>
                <Progress value={phase === 'uploading' ? Math.round(progress * 100) : null} aria-label="Transcription progress" />
              </div>
            )}

            {configured && remainingSeconds === 0 && !busy && (
              <p className="text-xs text-muted-foreground" role="status">
                You’ve used all of this period’s transcription minutes, so Transcribe is off until they reset. See the meter below.
              </p>
            )}

            <Button type="button" onClick={transcribe} disabled={!canTranscribe} className="purple-glow w-full">
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : retryable ? <RefreshCw aria-hidden="true" /> : <FileText aria-hidden="true" />}
              {phase === 'uploading' ? 'Uploading…' : phase === 'transcribing' ? 'Transcribing…' : retryable ? 'Try again' : 'Transcribe'}
            </Button>
          </CardContent>
        </Card>

        <QuotaMeter label="Transcription this period" allowance={usage?.stt ?? null} unavailable={usageUnavailable} unit="minutes" resetsAt={usage?.period.end ?? null} />
      </div>

      <Card className="min-w-0 self-start">
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
          <CardDescription>
            {transcript
              ? `${transcript.fileName} · ${clockLabel(transcript.duration)} · ${languageLabel(transcript.language)}`
              : 'Your transcript will appear here.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!transcript ? (
            <EmptyState
              icon={FileText}
              title={phase === 'transcribing' ? 'Transcribing your file…' : 'No transcript yet'}
              description="Upload an audio file and press Transcribe."
              className="py-10"
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyTranscript} disabled={!transcript.text}>
                  <Copy aria-hidden="true" /> Copy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => download(toPlainText(transcript.text, transcript.words, transcript.language), `${baseFileName(transcript.fileName)}.txt`, 'text/plain;charset=utf-8')}
                  disabled={!transcript.text}
                >
                  <Download aria-hidden="true" /> .txt
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => download(toSrt(transcript.words, transcript.language), `${baseFileName(transcript.fileName)}.srt`, 'application/x-subrip;charset=utf-8')}
                  disabled={transcript.words.length === 0}
                >
                  <Download aria-hidden="true" /> .srt
                </Button>
                {transcript.words.length > 0 && (
                  <label htmlFor={`${ids}-timings`} className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Switch id={`${ids}-timings`} size="sm" checked={showTimings} onCheckedChange={setShowTimings} />
                    Word timings
                  </label>
                )}
              </div>

              {!transcript.text ? (
                <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                  We didn’t hear any speech in this file. Check the language setting and that the recording has audible voices.
                </p>
              ) : showTimings && transcript.words.length > 0 ? (
                <div lang={transcript.language} className="max-h-[28rem] overflow-y-auto rounded-lg border p-3 text-sm leading-7">
                  {transcript.words.map((word, index) => (
                    <button
                      key={`${index}-${word.start}`}
                      type="button"
                      onClick={() => seek(word.start)}
                      title={`${clockLabel(word.start)}`}
                      className="mr-1 inline-flex items-baseline gap-1 rounded px-0.5 hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
                      aria-label={`${word.word} at ${clockLabel(word.start)}; play from here`}
                    >
                      <span className="text-foreground">{word.word}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{word.start.toFixed(1)}s</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p lang={transcript.language} className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed text-foreground">
                  {transcript.text}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
