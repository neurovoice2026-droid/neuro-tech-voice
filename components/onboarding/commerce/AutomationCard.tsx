'use client'

// One automation template: what triggers it, who gets called and when, the
// script with sample values, the legal-basis confirmation and the switch.
// The switch is off by default and locked until the consent is confirmed;
// an unavailable template (platform capability missing) shows why and no
// controls at all.

import { useEffect, useId, useState } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import type { AutomationDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { CommerceRequestError, commerceErrorMessage, isAbort, requestJson } from './api'
import {
  AUTOMATION_DESCRIPTIONS,
  AUTOMATION_ENABLE_REASONS,
  AUTOMATION_TITLES,
  CONSENT_TEXT,
  automationRules,
  formatDate,
  formatDays,
  formatMinutes,
} from './copy'

interface AutomationCardProps {
  automation: AutomationDto
  connectionId: string
  /** The store's time zone, shown when the automation follows it (config.timezone null). */
  storeTimezone: string
  onChange: (automation: AutomationDto) => void
}

interface PreviewState {
  text: string | null
  error: string | null
  loading: boolean
}

function enableErrorMessage(err: unknown): string {
  if (err instanceof CommerceRequestError && err.reason && AUTOMATION_ENABLE_REASONS[err.reason]) {
    return AUTOMATION_ENABLE_REASONS[err.reason]
  }
  return commerceErrorMessage(err, 'Automatizarea nu a putut fi salvată.')
}

export function AutomationCard({ automation, connectionId, storeTimezone, onChange }: AutomationCardProps) {
  const ids = { consent: useId(), enable: useId(), title: useId() }
  const [saving, setSaving] = useState<'consent' | 'enabled' | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ text: null, error: null, loading: automation.available })
  const [previewKey, setPreviewKey] = useState(0)

  const { type, config } = automation
  const consented = !!automation.consent_confirmed_at
  const rules = automationRules(type, config)
  const windowZone = config.timezone ?? storeTimezone

  // A retry resets the block here (not inside the effect) and re-runs the load.
  function retryPreview() {
    setPreview({ text: null, error: null, loading: true })
    setPreviewKey((k) => k + 1)
  }

  useEffect(() => {
    if (!automation.available) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ type, connection_id: connectionId })
    requestJson<{ text: string }>(`/api/commerce/script-preview?${params}`, { signal: ctrl.signal, fallback: 'Previzualizarea scriptului nu a putut fi încărcată.' })
      .then((data) => {
        if (!ctrl.signal.aborted) setPreview({ text: data.text, error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || isAbort(err)) return
        setPreview({ text: null, error: commerceErrorMessage(err, 'Previzualizarea scriptului nu a putut fi încărcată.'), loading: false })
      })
    return () => ctrl.abort()
  }, [automation.available, type, connectionId, previewKey])

  async function save(body: { enabled?: boolean; consent_confirmed?: true }, kind: 'consent' | 'enabled') {
    if (saving) return
    setSaving(kind)
    try {
      const data = await requestJson<{ automation: AutomationDto }>(`/api/commerce/automations/${type}`, {
        method: 'PUT',
        body: { connection_id: connectionId, ...body },
        fallback: 'Automatizarea nu a putut fi salvată.',
      })
      onChange(data.automation)
      if (kind === 'enabled') toast.success(body.enabled ? `„${AUTOMATION_TITLES[type]}” este activă.` : `„${AUTOMATION_TITLES[type]}” a fost oprită.`)
    } catch (err) {
      toast.error(enableErrorMessage(err))
    } finally {
      setSaving(null)
    }
  }

  if (!automation.available) {
    return (
      <Card className="gap-0 py-0 opacity-70" aria-labelledby={ids.title}>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id={ids.title} className="text-[15px] leading-[22px] font-medium text-foreground">
                {AUTOMATION_TITLES[type]}
              </h3>
              <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">{AUTOMATION_DESCRIPTIONS[type]}</p>
            </div>
            <StatusChip tone="muted" dot>
              Indisponibil
            </StatusChip>
          </div>
          <Alert>
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>{automation.unavailable_reason ?? 'Platforma magazinului nu oferă datele necesare acestei automatizări.'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="gap-0 py-0" aria-labelledby={ids.title}>
      <CardContent className="space-y-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={ids.title} className="text-[15px] leading-[22px] font-medium text-foreground">
              {AUTOMATION_TITLES[type]}
            </h3>
            <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">{AUTOMATION_DESCRIPTIONS[type]}</p>
          </div>
          <StatusChip tone={automation.enabled ? 'success' : 'muted'} dot>
            {automation.enabled ? 'Activă' : 'Oprită'}
          </StatusChip>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-[13px] leading-[19px] sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Declanșator</dt>
          <dd className="text-foreground">{rules.trigger}</dd>
          <dt className="text-muted-foreground">Întârziere</dt>
          <dd className="text-foreground">{formatMinutes(config.delay_minutes)} după eveniment</dd>
          <dt className="text-muted-foreground">Pe cine sună</dt>
          <dd className="text-foreground">{rules.contact}</dd>
          <dt className="text-muted-foreground">Interval de apel</dt>
          <dd className="text-foreground">
            {config.call_window.start}–{config.call_window.end} · {formatDays(config.call_window.days)} · {windowZone}
          </dd>
          <dt className="text-muted-foreground">Limite</dt>
          <dd className="text-foreground">
            {config.daily_cap} apeluri/zi pentru această automatizare · cel mult {config.per_customer_daily_cap}/zi per client
          </dd>
          <dt className="text-muted-foreground">Reîncercări</dt>
          <dd className="text-foreground">
            {config.max_attempts === 1 ? 'un singur apel' : `până la ${config.max_attempts} apeluri, la ${formatMinutes(config.retry_minutes)}`}
          </dd>
        </dl>

        <div>
          <h4 className="text-[13px] leading-[19px] font-medium text-foreground">Ce va spune agentul (exemplu)</h4>
          <div className="mt-2 rounded-2xl bg-secondary p-4 text-[13px] leading-[20px] whitespace-pre-line text-foreground">
            {preview.loading && (
              <span className="flex items-center gap-2 text-muted-foreground" role="status">
                <OrbInline state="working" /> Se încarcă previzualizarea…
              </span>
            )}
            {!preview.loading && preview.error && (
              <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {preview.error}
                <Button variant="outline" size="xs" onClick={retryPreview}>
                  <RotateCw aria-hidden="true" /> Reîncearcă
                </Button>
              </span>
            )}
            {!preview.loading && preview.text}
          </div>
        </div>

        <div className="space-y-4 border-t border-rule pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id={ids.consent}
              checked={consented}
              // Once confirmed the consent is on record (date and version kept server-side).
              disabled={consented || saving !== null}
              onCheckedChange={(checked) => {
                if (checked === true && !consented) void save({ consent_confirmed: true }, 'consent')
              }}
              className="mt-0.5"
            />
            <Label htmlFor={ids.consent} className="flex-col items-start gap-1 text-[13px] leading-[19px] font-normal">
              <span>{CONSENT_TEXT}</span>
              {consented && <span className="text-xs leading-4 text-muted-foreground">Confirmat la {formatDate(automation.consent_confirmed_at) ?? '—'}</span>}
              {saving === 'consent' && (
                <span className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
                  <OrbInline state="working" /> Se salvează…
                </span>
              )}
            </Label>
          </div>

          <div className={cn('flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3', !consented && 'opacity-70')}>
            <Label htmlFor={ids.enable} className="flex-col items-start gap-0.5">
              <span>Activează automatizarea</span>
              <span className="text-xs leading-4 font-normal text-muted-foreground">
                {consented ? 'Apelurile pornesc după lansare, în intervalul de mai sus.' : 'Bifează mai întâi confirmarea de mai sus.'}
              </span>
            </Label>
            <div className="flex items-center gap-2">
              {saving === 'enabled' && <OrbInline state="working" label="Se salvează" />}
              <Switch
                id={ids.enable}
                checked={automation.enabled}
                disabled={!consented || saving !== null}
                onCheckedChange={(checked) => void save({ enabled: checked }, 'enabled')}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
