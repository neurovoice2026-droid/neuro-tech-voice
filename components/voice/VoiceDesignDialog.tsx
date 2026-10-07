'use client'

// "Design a voice": describe a voice, listen to 3 generated previews, save one
// as a custom voice of the workspace. The server records which previews this
// organization received; only those can be saved.

import { useId, useState, type FormEvent } from 'react'
import { AlertCircle, Check, Info, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { voiceDisplayName } from '@/components/voice/VoiceCard'
import { ApiError, errorMessage, invalidateVoiceCatalog, parseApiError } from '@/hooks/useVoiceCatalog'
import { cn } from '@/lib/utils'
import type { VoiceOption } from '@/types'

const DESCRIPTION_MIN = 20
const DESCRIPTION_MAX = 1000
const TEXT_MIN = 100
const TEXT_MAX = 1000
const NAME_MAX = 100

interface DesignPreview {
  generated_voice_id: string
  audio_base_64: string
  media_type: string
  duration_secs: number | null
}

export interface VoiceDesignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Language of the previews (the agent's language). */
  language?: string | null
  /** Called with the saved voice; the workspace catalog is refreshed already. */
  onSaved?: (voice: VoiceOption) => void
}

const EXAMPLES = [
  'A warm, friendly female receptionist in her thirties, calm and professional, speaking clearly at a relaxed pace.',
  'A confident middle-aged male voice, reassuring and polite, with a slightly deep tone, like a trusted clinic front desk.',
]

export function VoiceDesignDialog({ open, onOpenChange, language, onSaved }: VoiceDesignDialogProps) {
  const ids = { description: useId(), descriptionHint: useId(), text: useId(), name: useId() }
  const [description, setDescription] = useState('')
  const [useOwnText, setUseOwnText] = useState(false)
  const [text, setText] = useState('')
  const [previews, setPreviews] = useState<DesignPreview[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descriptionLength = description.trim().length
  const textLength = text.trim().length
  const canGenerate =
    !generating &&
    !saving &&
    descriptionLength >= DESCRIPTION_MIN &&
    descriptionLength <= DESCRIPTION_MAX &&
    (!useOwnText || (textLength >= TEXT_MIN && textLength <= TEXT_MAX))
  const canSave = !saving && !generating && !!selected && name.trim().length > 0

  function reset() {
    setDescription('')
    setUseOwnText(false)
    setText('')
    setPreviews([])
    setSelected(null)
    setName('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next && (generating || saving)) return
    if (!next) reset()
    onOpenChange(next)
  }

  async function generate(e?: FormEvent) {
    e?.preventDefault()
    if (!canGenerate) return
    setGenerating(true)
    setError(null)
    setSelected(null)
    try {
      const res = await fetch('/api/voices/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          ...(useOwnText && textLength ? { text: text.trim() } : {}),
          ...(language ? { language } : {}),
        }),
      })
      if (!res.ok) throw await parseApiError(res, 'Could not design voices. Please try again.')
      const data = (await res.json()) as { previews?: DesignPreview[] }
      const list = Array.isArray(data.previews) ? data.previews.filter((p) => p.generated_voice_id && p.audio_base_64) : []
      if (!list.length) throw new ApiError('No voice could be generated from this description. Try describing it differently.', 502)
      setPreviews(list)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'You have designed many voices recently. Please try again later.'
          : errorMessage(err, 'Could not design voices. Please try again.'),
      )
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!canSave || !selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/voices/design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ generated_voice_id: selected, name: name.trim() }),
      })
      if (!res.ok) throw await parseApiError(res, 'Could not save this voice. Please try again.')
      const json = (await res.json()) as { voice?: VoiceOption }
      if (!json.voice) throw new ApiError('Unexpected response while saving the voice.', res.status)
      invalidateVoiceCatalog('workspace')
      toast.success(`"${voiceDisplayName(json.voice)}" is ready`, { description: 'You can now choose it as your agent’s voice.' })
      onSaved?.(json.voice)
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not save this voice. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(e) => void generate(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-4 text-primary" aria-hidden="true" /> Design a voice
            </DialogTitle>
            <DialogDescription>
              Describe the voice you want. We generate three versions; listen and keep the one you like.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={ids.description}>Voice description</Label>
              <span className={cn('text-xs', descriptionLength > DESCRIPTION_MAX ? 'text-destructive' : 'text-muted-foreground')}>
                {descriptionLength}/{DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id={ids.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder={EXAMPLES[0]}
              aria-describedby={ids.descriptionHint}
              disabled={generating || saving}
            />
            <p id={ids.descriptionHint} className="text-xs text-muted-foreground">
              At least {DESCRIPTION_MIN} characters: age, gender, tone, pace, accent. Do not name a real person.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setDescription(ex)}
                  disabled={generating || saving}
                  className="rounded-full border px-2.5 py-1 text-left text-[11px] text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  {ex.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={useOwnText}
                onChange={(e) => setUseOwnText(e.target.checked)}
                disabled={generating || saving}
              />
              Use my own sample sentence
            </label>
            {useOwnText && (
              <div className="space-y-1">
                <Label htmlFor={ids.text} className="sr-only">
                  Sample sentence
                </Label>
                <Textarea
                  id={ids.text}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={TEXT_MAX}
                  rows={3}
                  placeholder="What the previews should say (100–1000 characters)."
                  disabled={generating || saving}
                />
                <p className={cn('text-xs', textLength && textLength < TEXT_MIN ? 'text-destructive' : 'text-muted-foreground')}>
                  {textLength}/{TEXT_MAX} characters (at least {TEXT_MIN}).
                </p>
              </div>
            )}
          </div>

          <Button type="submit" variant={previews.length ? 'outline' : 'default'} disabled={!canGenerate} className="gap-1.5">
            {generating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {generating ? 'Designing voices…' : previews.length ? 'Design again' : 'Design voices'}
          </Button>

          {previews.length > 0 && (
            <fieldset className="space-y-2" disabled={saving}>
              <legend className="mb-1 text-sm font-medium">Choose a version</legend>
              <div role="radiogroup" aria-label="Generated voices" className="space-y-2">
                {previews.map((p, i) => {
                  const checked = selected === p.generated_voice_id
                  return (
                    <div
                      key={p.generated_voice_id}
                      className={cn('flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center', checked ? 'border-primary bg-primary/5' : 'border-border')}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => setSelected(p.generated_voice_id)}
                        className="flex shrink-0 items-center gap-2 rounded-md text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span
                          className={cn('flex size-5 items-center justify-center rounded-full border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}
                          aria-hidden="true"
                        >
                          {checked && <Check className="size-3" />}
                        </span>
                        Version {i + 1}
                      </button>
                      <audio
                        controls
                        preload="none"
                        src={`data:audio/mpeg;base64,${p.audio_base_64}`}
                        aria-label={`Listen to version ${i + 1}`}
                        className="h-9 w-full min-w-0"
                      />
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )}

          {previews.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={ids.name}>Voice name</Label>
              <Input
                id={ids.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                // The surrounding form designs voices: Enter here must save the
                // chosen version, never regenerate (and lose) the previews.
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                  e.preventDefault()
                  void save()
                }}
                enterKeyHint="done"
                maxLength={NAME_MAX}
                placeholder="e.g. Front desk – warm"
                autoComplete="off"
                disabled={saving}
              />
            </div>
          )}

          <div className="flex gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Your description is sent to our voice provider (ElevenLabs) to generate the voice. A saved voice counts
              towards your custom voices and can be deleted at any time.
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={generating || saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!canSave} className="gap-1.5">
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {saving ? 'Saving voice…' : 'Save voice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
