'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_SERVICES, SERVICE_DURATION_MAX, SERVICE_DURATION_MIN } from '@/app/api/scheduling/hours'

export interface ServiceDraft {
  /** Local key for React lists; not saved. */
  key: string
  name: string
  duration: string
}

let serviceKey = 0
export function newServiceKey(): string {
  serviceKey += 1
  return `service-${serviceKey}`
}

export function serviceErrors(services: ServiceDraft[]): Record<string, { name?: string; duration?: string }> {
  const errors: Record<string, { name?: string; duration?: string }> = {}
  const seen = new Set<string>()
  for (const s of services) {
    const e: { name?: string; duration?: string } = {}
    const name = s.name.trim()
    if (!name) e.name = 'Give the service a name.'
    else if (name.length > 80) e.name = 'Keep the name under 80 characters.'
    else if (seen.has(name.toLowerCase())) e.name = 'Each service needs a different name.'
    seen.add(name.toLowerCase())
    const minutes = Number(s.duration)
    if (!Number.isInteger(minutes) || minutes < SERVICE_DURATION_MIN || minutes > SERVICE_DURATION_MAX) {
      e.duration = `${SERVICE_DURATION_MIN}–${SERVICE_DURATION_MAX} minutes.`
    }
    if (e.name || e.duration) errors[s.key] = e
  }
  return errors
}

interface ServicesEditorProps {
  value: ServiceDraft[]
  onChange: (next: ServiceDraft[]) => void
  disabled?: boolean
}

export function ServicesEditor({ value, onChange, disabled }: ServicesEditorProps) {
  const errors = serviceErrors(value)
  const update = (key: string, patch: Partial<ServiceDraft>) =>
    onChange(value.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No services yet. Without a list, every booking uses your slot length.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((service, index) => {
            const e = errors[service.key] ?? {}
            return (
              <li key={service.key} className="rounded-lg border p-2.5">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem]">
                    <div>
                      <Input
                        value={service.name}
                        onChange={(ev) => update(service.key, { name: ev.target.value })}
                        placeholder="e.g. Consultation"
                        aria-label={`Service ${index + 1} name`}
                        aria-invalid={Boolean(e.name)}
                        disabled={disabled}
                      />
                      {e.name && <p className="mt-1 text-xs text-destructive">{e.name}</p>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={SERVICE_DURATION_MIN}
                          max={SERVICE_DURATION_MAX}
                          step={5}
                          value={service.duration}
                          onChange={(ev) => update(service.key, { duration: ev.target.value })}
                          aria-label={`Service ${index + 1} length in minutes`}
                          aria-invalid={Boolean(e.duration)}
                          disabled={disabled}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                      {e.duration && <p className="mt-1 text-xs text-destructive">{e.duration}</p>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onChange(value.filter((s) => s.key !== service.key))}
                    disabled={disabled}
                    aria-label={`Remove ${service.name || `service ${index + 1}`}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { key: newServiceKey(), name: '', duration: '30' }])}
        disabled={disabled || value.length >= MAX_SERVICES}
      >
        <Plus aria-hidden="true" />
        Add a service
      </Button>
      {value.length >= MAX_SERVICES && (
        <p className="text-xs text-muted-foreground">You’ve reached the limit of {MAX_SERVICES} services.</p>
      )}
    </div>
  )
}
