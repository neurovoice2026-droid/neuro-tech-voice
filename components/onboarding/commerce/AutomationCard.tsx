'use client'

// One automation template: what triggers it, who gets called and when, the
// script with sample values, the lawful-basis confirmation and the switch.
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
import { AUTOMATION_TYPE_DESCRIPTION, AUTOMATION_TYPE_LABEL } from '@/components/commerce/labels'
import type { AutomationDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { commerceErrorMessage, isAbort, requestJson } from './api'
import { CONSENT_TEXT, automationRules, formatDate, formatDays, formatMinutes } from './copy'

const SAVE_FAILED = 'The automation could not be saved.'
const PREVIEW_FAILED = 'The script preview could not be loaded.'

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
    requestJson<{ text: string }>(`/api/commerce/script-preview?${params}`, { signal: ctrl.signal, fallback: PREVIEW_FAILED })
      .then((data) => {
        if (!ctrl.signal.aborted) setPreview({ text: data.text, error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || isAbort(err)) return
        setPreview({ text: null, error: commerceErrorMessage(err, PREVIEW_FAILED), loading: false })
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
        fallback: SAVE_FAILED,
      })
      onChange(data.automation)
      if (kind === 'enabled') toast.success(body.enabled ? 'Automation turned on' : 'Automation turned off', { description: AUTOMATION_TYPE_LABEL[type] })
    } catch (err) {
      // A refused enable (409) carries the route's own reason, the same line the dashboard shows.
      toast.error(commerceErrorMessage(err, SAVE_FAILED))
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
                {AUTOMATION_TYPE_LABEL[type]}
              </h3>
              <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">{AUTOMATION_TYPE_DESCRIPTION[type]}</p>
            </div>
            <StatusChip tone="muted" dot>
              Unavailable
            </StatusChip>
          </div>
          <Alert>
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>{automation.unavailable_reason ?? 'Your store platform does not provide the data this automation needs.'}</AlertDescription>
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
              {AUTOMATION_TYPE_LABEL[type]}
            </h3>
            <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">{AUTOMATION_TYPE_DESCRIPTION[type]}</p>
          </div>
          <StatusChip tone={automation.enabled ? 'success' : 'muted'} dot>
            {automation.enabled ? 'On' : 'Off'}
          </StatusChip>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-[13px] leading-[19px] sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Trigger</dt>
          <dd className="text-foreground">{rules.trigger}</dd>
          <dt className="text-muted-foreground">Delay</dt>
          <dd className="text-foreground">{formatMinutes(config.delay_minutes)} after the event</dd>
          <dt className="text-muted-foreground">Who gets called</dt>
          <dd className="text-foreground">{rules.contact}</dd>
          <dt className="text-muted-foreground">Call window</dt>
          <dd className="text-foreground">
            {config.call_window.start}–{config.call_window.end} · {formatDays(config.call_window.days)} · {windowZone}
          </dd>
          <dt className="text-muted-foreground">Limits</dt>
          <dd className="text-foreground">
            {config.daily_cap} calls/day for this automation · at most {config.per_customer_daily_cap}/day per customer
          </dd>
          <dt className="text-muted-foreground">Retries</dt>
          <dd className="text-foreground">
            {config.max_attempts === 1 ? 'a single call' : `up to ${config.max_attempts} calls, ${formatMinutes(config.retry_minutes)} apart`}
          </dd>
        </dl>

        <div>
          <h4 className="text-[13px] leading-[19px] font-medium text-foreground">What the agent will say (example)</h4>
          <div className="mt-2 rounded-2xl bg-secondary p-4 text-[13px] leading-[20px] whitespace-pre-line text-foreground">
            {preview.loading && (
              <span className="flex items-center gap-2 text-muted-foreground" role="status">
                <OrbInline state="working" /> Loading the preview…
              </span>
            )}
            {!preview.loading && preview.error && (
              <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {preview.error}
                <Button variant="outline" size="xs" onClick={retryPreview}>
                  <RotateCw aria-hidden="true" /> Retry
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
              {consented && <span className="text-xs leading-4 text-muted-foreground">Confirmed on {formatDate(automation.consent_confirmed_at) ?? '—'}</span>}
              {saving === 'consent' && (
                <span className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
                  <OrbInline state="working" /> Saving…
                </span>
              )}
            </Label>
          </div>

          <div className={cn('flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3', !consented && 'opacity-70')}>
            <Label htmlFor={ids.enable} className="flex-col items-start gap-0.5">
              <span>Turn on this automation</span>
              <span className="text-xs leading-4 font-normal text-muted-foreground">
                {consented ? 'Calls start after launch, within the window above.' : 'Confirm the statement above first.'}
              </span>
            </Label>
            <div className="flex items-center gap-2">
              {saving === 'enabled' && <OrbInline state="working" label="Saving" />}
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
