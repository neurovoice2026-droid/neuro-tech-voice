'use client'

// Pronunciation rules: "say this word as …" for the business name, staff
// names, products, streets and acronyms. Saved as the organization's
// pronunciation dictionary and applied to the live agent and to previews.

import { useEffect, useEffectEvent, useId, useState } from 'react'
import { AlertCircle, ArrowRight, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { FormSection } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PreviewButton } from '@/components/voice/VoiceCard'
import { useAudioPreview } from '@/hooks/useAudioPreview'
import { errorMessage, isAbortError, parseApiError } from '@/hooks/useVoiceCatalog'
import type { Agent } from '@/types'

const TERM_MAX = 64
const SAY_AS_MAX = 128
const PREVIEW_MAX = 200

interface Rule {
  key: string
  term: string
  say_as: string
  case_sensitive: boolean
}

interface ServerRule {
  term: string
  say_as: string
  case_sensitive?: boolean
  word_boundaries?: boolean
}

let keySeq = 0
const newKey = () => `rule-${++keySeq}`

function toRules(list: ServerRule[]): Rule[] {
  return list.map((r) => ({ key: newKey(), term: r.term, say_as: r.say_as, case_sensitive: r.case_sensitive === true }))
}

function serialize(rules: Rule[]): string {
  return JSON.stringify(rules.map((r) => [r.term.trim(), r.say_as.trim(), r.case_sensitive]))
}

const ALLOWED = /^[\p{L}\p{M}\p{N} .,'’&+/()-]*$/u

function validate(rules: Rule[], max: number): string | null {
  if (rules.length > max) return `You can add up to ${max} words.`
  const seen = new Set<string>()
  for (const r of rules) {
    const term = r.term.trim()
    const sayAs = r.say_as.trim()
    if (!term || !sayAs) return 'Fill in both the word and how to say it, or remove the empty row.'
    if (term.length > TERM_MAX || sayAs.length > SAY_AS_MAX) return 'One of the entries is too long.'
    if (!ALLOWED.test(term) || !ALLOWED.test(sayAs)) return `"${term}" contains unsupported characters.`
    const k = term.toLowerCase()
    if (seen.has(k)) return `"${term}" is listed twice.`
    seen.add(k)
  }
  return null
}

export interface PronunciationCardProps {
  agent: Pick<Agent, 'voice_id' | 'language'>
}

export function PronunciationCard({ agent }: PronunciationCardProps) {
  const listId = useId()
  const [rules, setRules] = useState<Rule[]>([])
  const [saved, setSaved] = useState<string>('[]')
  const [maxRules, setMaxRules] = useState(100)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const preview = useAudioPreview()

  const applyServer = useEffectEvent((list: ServerRule[], max: number) => {
    const next = toRules(list)
    setRules(next)
    setSaved(serialize(next))
    setMaxRules(max)
  })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    fetch('/api/agent/voice/pronunciation', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw await parseApiError(res, 'Could not load your pronunciation list.')
        const data = (await res.json()) as { rules?: ServerRule[]; max_rules?: number }
        applyServer(Array.isArray(data.rules) ? data.rules : [], typeof data.max_rules === 'number' ? data.max_rules : 100)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return
        setLoadError(errorMessage(err, 'Could not load your pronunciation list.'))
        setLoading(false)
      })
    return () => controller.abort()
  }, [reload])

  const dirty = serialize(rules) !== saved
  const problem = dirty ? validate(rules, maxRules) : null

  function update(key: string, patch: Partial<Rule>) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function save() {
    if (!dirty || saving || problem) return
    setSaving(true)
    try {
      const res = await fetch('/api/agent/voice/pronunciation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          rules: rules.map((r) => ({ term: r.term.trim(), say_as: r.say_as.trim(), case_sensitive: r.case_sensitive, word_boundaries: true })),
        }),
      })
      if (!res.ok) throw await parseApiError(res, 'Could not save your pronunciation list.')
      const data = (await res.json()) as { rules?: ServerRule[]; sync?: { status: string; error: string | null } | null }
      const next = toRules(Array.isArray(data.rules) ? data.rules : [])
      setRules(next)
      setSaved(serialize(next))
      if (data.sync && (data.sync.status === 'failed' || data.sync.status === 'degraded')) {
        toast.error('Saved, but not applied to your agent yet', { description: data.sync.error ?? 'It will be retried automatically.' })
      } else {
        toast.success('Pronunciation saved', { description: 'Your agent uses it from the next call.' })
      }
    } catch (err) {
      toast.error('Could not save your pronunciation list', { description: errorMessage(err, 'Please try again.') })
    } finally {
      setSaving(false)
    }
  }

  const sample = rules
    .filter((r) => r.term.trim())
    .map((r) => r.term.trim())
    .join(', ')
    .slice(0, PREVIEW_MAX)

  return (
    <FormSection
      title="Pronunciation"
      description={
        <>
          Teach your agent how to say your business name, staff names, products or streets. Write how it should
          sound, for example &quot;Xenia&quot; → &quot;Ksenia&quot;.
        </>
      }
      aside={
        agent.voice_id && sample ? (
          <PreviewButton
            name="your pronunciation list"
            variant="wide"
            disabled={dirty}
            status={preview.statusFor('pronunciation')}
            onClick={() =>
              preview.toggle('pronunciation', {
                kind: 'request',
                url: '/api/voices/preview',
                method: 'POST',
                body: { voice_id: agent.voice_id, text: sample, ...(agent.language ? { language: agent.language } : {}) },
              })
            }
          />
        ) : undefined
      }
    >
      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{loadError}</AlertTitle>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>
              <RotateCw aria-hidden="true" /> Try again
            </Button>
          </AlertAction>
        </Alert>
      ) : loading ? (
        <OrbLoader size={32} layout="row" label="Loading your pronunciation list…" className="min-h-[212px] md:min-h-[156px]" />
      ) : (
        <div className="@container/pron space-y-4">
          {rules.length === 0 ? (
            <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-[13px] leading-[19px] text-muted-foreground">
              No words yet. Add the names your agent mispronounces.
            </p>
          ) : (
            <div>
              {/* Column overlines for the wide layout; each field keeps its own label. */}
              <div
                aria-hidden="true"
                className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1.25fr)] gap-2 pb-2 text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase @md/pron:grid-cols-[minmax(0,1fr)_16px_minmax(0,1.25fr)_auto]"
              >
                <span>Word</span>
                <span />
                <span>Say it as</span>
                <span className="hidden w-[136px] @md/pron:block" />
              </div>
              <ul id={listId} className="divide-y divide-rule @md/pron:divide-y-0" aria-label="Pronunciation rules">
                {rules.map((r, i) => (
                  <li
                    key={r.key}
                    className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1.25fr)] items-center gap-2 py-3 first:pt-0 last:pb-0 @md/pron:grid-cols-[minmax(0,1fr)_16px_minmax(0,1.25fr)_auto] @md/pron:py-1"
                  >
                    <Input
                      value={r.term}
                      onChange={(e) => update(r.key, { term: e.target.value })}
                      maxLength={TERM_MAX}
                      placeholder="Word or name"
                      aria-label={`Word ${i + 1}`}
                      disabled={saving}
                    />
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={r.say_as}
                      onChange={(e) => update(r.key, { say_as: e.target.value })}
                      maxLength={SAY_AS_MAX}
                      placeholder="Say it as"
                      aria-label={`How to say word ${i + 1}`}
                      disabled={saving}
                    />
                    <div className="col-span-3 flex items-center justify-between gap-2 @md/pron:col-span-1 @md/pron:w-[136px] @md/pron:justify-end">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={r.case_sensitive}
                          onCheckedChange={(v) => update(r.key, { case_sensitive: v })}
                          disabled={saving}
                          aria-label={`Match the exact capitalisation of word ${i + 1}`}
                        />
                        Exact case
                      </label>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRules((prev) => prev.filter((x) => x.key !== r.key))}
                        disabled={saving}
                        aria-label={`Remove word ${i + 1}`}
                        className="tap-44"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {problem && (
            <p role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" /> {problem}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-rule pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRules((prev) => [...prev, { key: newKey(), term: '', say_as: '', case_sensitive: false }])}
              disabled={saving || rules.length >= maxRules}
            >
              <Plus aria-hidden="true" /> Add word
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              {dirty && <span className="text-xs text-muted-foreground">Save to hear your changes.</span>}
              <Button size="sm" onClick={() => void save()} disabled={!dirty || !!problem} loading={saving} loadingText="Saving…">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </FormSection>
  )
}
