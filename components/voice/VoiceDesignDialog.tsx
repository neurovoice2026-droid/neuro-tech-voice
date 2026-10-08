'use client'

// "Design a voice": describe a voice, listen to 3 generated previews, save one
// as a custom voice of the workspace. The server records which previews this
// organization received; only those can be saved.

import { useId, useState, type FormEvent } from 'react'
import { AlertCircle, Info, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Field } from '@/components/shared/FormSection'
import { OptionCard } from '@/components/shared/OptionCard'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PreviewButton, voiceDisplayName } from '@/components/voice/VoiceCard'
import { useAudioPreview } from '@/hooks/useAudioPreview'
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
  const ids = { description: useId(), ownText: useId(), text: useId(), name: useId() }
  const [description, setDescription] = useState('')
  const [useOwnText, setUseOwnText] = useState(false)
  const [text, setText] = useState('')
  const [previews, setPreviews] = useState<DesignPreview[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The generated versions play through the same one-at-a-time preview player as the picker.
  const preview = useAudioPreview()

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
    preview.stop()
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
    preview.stop()
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
    preview.stop()
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
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={(e) => void generate(e)} className="grid min-w-0 gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Design a voice</DialogTitle>
            <DialogDescription>
              Describe the voice you want. We generate three versions; listen and keep the one you like.
            </DialogDescription>
          </DialogHeader>

          {generating ? (
            // The form is locked while the provider shapes the voices: the orb takes its place.
            <OrbLoader
              state="shaping"
              size={64}
              label="Designing three voices…"
              delayMs={0}
              className="min-h-[248px] rounded-2xl bg-secondary px-6"
            />
          ) : (
            <div className="grid min-w-0 gap-4">
              <Field
                label="Voice description"
                htmlFor={ids.description}
                labelAction={
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      descriptionLength > DESCRIPTION_MAX ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {descriptionLength}/{DESCRIPTION_MAX}
                  </span>
                }
                hint={`At least ${DESCRIPTION_MIN} characters: age, gender, tone, pace, accent. Do not name a real person.`}
              >
                <Textarea
                  id={ids.description}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  rows={4}
                  placeholder="Describe the voice you want…"
                  disabled={saving}
                />
              </Field>

              <div className="grid min-w-0 gap-1.5">
                <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Examples
                </p>
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <Button
                      key={ex}
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => setDescription(ex)}
                      disabled={saving}
                      title={ex}
                      className="tap-44 max-w-full justify-start font-normal"
                    >
                      <span className="truncate">{ex}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id={ids.ownText}
                    checked={useOwnText}
                    onCheckedChange={(v) => setUseOwnText(v)}
                    disabled={saving}
                  />
                  <Label htmlFor={ids.ownText} className="cursor-pointer text-sm font-normal">
                    Use my own sample sentence
                  </Label>
                </div>
                {useOwnText && (
                  <div className="grid gap-2">
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
                      disabled={saving}
                    />
                    <p
                      className={cn(
                        'text-xs leading-4 tabular-nums',
                        textLength && textLength < TEXT_MIN ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {textLength}/{TEXT_MAX} characters (at least {TEXT_MIN}).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant={previews.length ? 'outline' : 'default'}
            disabled={!canGenerate}
            loading={generating}
            loadingState="shaping"
            loadingText="Designing voices…"
            className="w-full sm:w-fit"
          >
            <Sparkles aria-hidden="true" />
            {previews.length ? 'Design again' : 'Design voices'}
          </Button>

          {previews.length > 0 && !generating && (
            <fieldset className="grid min-w-0 gap-2" disabled={saving}>
              <legend className="mb-2 text-[13px] leading-4 font-medium">Choose a version</legend>
              <div role="radiogroup" aria-label="Generated voices" className="grid gap-2">
                {previews.map((p, i) => {
                  const checked = selected === p.generated_voice_id
                  const label = `Version ${i + 1}`
                  return (
                    <div key={p.generated_voice_id} className="relative">
                      <OptionCard
                        selected={checked}
                        onSelect={() => setSelected(p.generated_voice_id)}
                        title={label}
                        className="min-h-14 justify-center py-3 pl-14"
                      />
                      <PreviewButton
                        name={label}
                        variant="icon"
                        status={preview.statusFor(p.generated_voice_id)}
                        onClick={() =>
                          preview.toggle(p.generated_voice_id, {
                            kind: 'url',
                            url: `data:audio/mpeg;base64,${p.audio_base_64}`,
                          })
                        }
                        className="absolute top-1/2 left-3 -translate-y-1/2"
                      />
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )}

          {previews.length > 0 && !generating && (
            <Field label="Voice name" htmlFor={ids.name}>
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
            </Field>
          )}

          <Alert role="note">
            <Info aria-hidden="true" />
            <AlertDescription>
              Your description is sent to our voice provider (ElevenLabs) to generate the voice. A saved voice counts
              towards your custom voices and can be deleted at any time.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={generating || saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!canSave} loading={saving} loadingText="Saving voice…">
              Save voice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
