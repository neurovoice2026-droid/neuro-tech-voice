'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useForm, useController, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, Plus, RotateCw, Save, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormSection } from '@/components/shared/FormSection'
import { Chip } from '@/components/shared/OptionCard'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import { CommerceApiError, commerceErrorMessage, isAbortError } from '@/hooks/useCommerceApi'
import { fetchScriptPreview, saveAutomation } from '@/hooks/useCommerceAutomations'
import type { AutomationDto } from '@/lib/commerce/types'
import { WEEKDAYS, type Weekday } from '@/lib/scheduling/time'
import {
  ABANDONED_CART_MIN_DELAY, AUTOMATION_LIMITS, automationFormSchema, bodyFromValues, formValuesFrom, serverFieldErrors, type AutomationFormValues,
} from './automation-schema'
import { formatDateTime } from './format'
import { CONSENT_TEXT, FOLLOW_UP_STATUS_LABEL, ORDER_STATUSES, SCRIPT_VARIABLES, TONE_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT } from './labels'

// The full configuration of one automation template: timing, limits, the
// type's own criteria, the script and the merchant's consent. Everything is
// initialised from the AutomationDto and written back with one PUT.

/** Sentinel for "the organization's time zone" in the Select (its real value is null). */
const ORG_ZONE = '__org__'

const FALLBACK_TIME_ZONES = ['Europe/Bucharest', 'Europe/Chisinau', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome', 'Europe/Athens', 'UTC']

function timeZoneOptions(current: string): string[] {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : FALLBACK_TIME_ZONES
  const zones = new Set(supported.length ? supported : FALLBACK_TIME_ZONES)
  zones.add('UTC')
  if (current) zones.add(current)
  return [...zones].sort((a, b) => (a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b)))
}

const FOLLOW_UP_OPTIONS = [...ORDER_STATUSES, 'fulfilled' as const].filter((s) => s !== 'unknown' && s !== 'draft')

type FormControl = Control<AutomationFormValues>

function DaysField({ control, id, error }: { control: FormControl; id: string; error?: string }) {
  const { field } = useController({ control, name: 'days' })
  const selected = new Set<Weekday>(field.value)
  function toggle(day: Weekday) {
    const next = new Set(selected)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    field.onChange(WEEKDAYS.filter((d) => next.has(d)))
  }
  return (
    <Field label={<span id={`${id}-label`}>Zilele în care sună</span>} htmlFor={id} error={error}>
      <div id={id} role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => (
          <Chip key={day} role="checkbox" pressed={selected.has(day)} onClick={() => toggle(day)} aria-label={WEEKDAY_LABEL[day]} className="min-w-10">
            {WEEKDAY_SHORT[day]}
          </Chip>
        ))}
      </div>
    </Field>
  )
}

function TimezoneField({ control, id }: { control: FormControl; id: string }) {
  const { field } = useController({ control, name: 'timezone' })
  const zones = useMemo(() => timeZoneOptions(field.value), [field.value])
  return (
    <Field label="Fus orar" htmlFor={id} hint="Fereastra de apel este citită în acest fus; implicit, fusul organizației.">
      <Select value={field.value || ORG_ZONE} onValueChange={(v) => field.onChange(v === ORG_ZONE || !v ? '' : String(v))}>
        <SelectTrigger id={id} className="w-full sm:w-80">
          <SelectValue>{(v: string) => (v === ORG_ZONE ? 'Fusul organizației' : v)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ORG_ZONE}>Fusul organizației</SelectItem>
          {zones.map((z) => (
            <SelectItem key={z} value={z}>{z}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function FollowUpStatusField({ control, id }: { control: FormControl; id: string }) {
  const { field } = useController({ control, name: 'follow_up_status' })
  return (
    <Field label="Statusul comenzii care declanșează apelul" htmlFor={id} hint="Apelul se programează când comanda ajunge la acest status.">
      <Select value={field.value} onValueChange={(v) => v && field.onChange(String(v))}>
        <SelectTrigger id={id} className="w-full sm:w-80">
          <SelectValue>{(v: string) => FOLLOW_UP_STATUS_LABEL[v as keyof typeof FOLLOW_UP_STATUS_LABEL] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FOLLOW_UP_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>{FOLLOW_UP_STATUS_LABEL[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Free-text chips: the payment method ids/titles the store uses for cash on delivery. */
function PaymentMethodsField({ control, id, error }: { control: FormControl; id: string; error?: string }) {
  const { field } = useController({ control, name: 'cod_payment_methods' })
  const [draft, setDraft] = useState('')
  const values: string[] = field.value
  function add() {
    const value = draft.trim()
    if (!value) return
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) field.onChange([...values, value])
    setDraft('')
  }
  function remove(value: string) {
    field.onChange(values.filter((v) => v !== value))
  }
  return (
    <Field
      label="Metode de plată care înseamnă ramburs"
      htmlFor={id}
      error={error}
      hint="Identificatorul sau titlul metodei de plată din magazin (de exemplu „cod” sau „Plata la livrare”). Apelul se face doar pentru comenzile cu una dintre ele."
    >
      <div className="space-y-2">
        {values.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Metode adăugate">
            {values.map((value) => (
              <li key={value}>
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary pr-1 pl-3 text-[13px] text-foreground">
                  {value}
                  <Button type="button" variant="ghost" size="icon-xs" className="tap-44 rounded-full text-muted-foreground hover:text-foreground" onClick={() => remove(value)} aria-label={`Elimină ${value}`}>
                    <X />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="cod"
            maxLength={AUTOMATION_LIMITS.cod_method_max_length}
            autoComplete="off"
            className="max-w-xs"
          />
          <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
            <Plus aria-hidden="true" />
            Adaugă
          </Button>
        </div>
      </div>
    </Field>
  )
}

function ToneField({ control, id }: { control: FormControl; id: string }) {
  const { field } = useController({ control, name: 'tone' })
  return (
    <Field label={<span id={`${id}-label`}>Ton</span>} htmlFor={id}>
      <div id={id} role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
        {(['friendly', 'formal'] as const).map((tone) => (
          <Chip key={tone} role="radio" pressed={field.value === tone} onClick={() => field.onChange(tone)}>
            {TONE_LABEL[tone]}
          </Chip>
        ))}
      </div>
    </Field>
  )
}

interface AutomationFormProps {
  automation: AutomationDto
  connectionId: string
  /** The server's row after a save or a consent confirmation. */
  onSaved: (automation: AutomationDto) => void
}

export function AutomationForm({ automation, connectionId, onSaved }: AutomationFormProps) {
  const id = useId()
  const { type } = automation
  const schema = useMemo(() => automationFormSchema(type), [type])
  const form = useForm<AutomationFormValues>({ resolver: zodResolver(schema), defaultValues: formValuesFrom(automation) })
  const { errors, isSubmitting, isDirty } = form.formState
  const templateRef = useRef<HTMLTextAreaElement | null>(null)
  const templateField = form.register('template')

  // The server's row (a consent confirmation, a pause from the header switch, a background refresh)
  // becomes the form's baseline only while nothing is being edited: unsaved edits are never discarded.
  useEffect(() => {
    if (!isDirty) form.reset(formValuesFrom(automation))
  }, [automation, form, isDirty])

  const [consentChecked, setConsentChecked] = useState(false)
  const [consentPending, setConsentPending] = useState(false)
  const [preview, setPreview] = useState<{ text: string } | { error: string } | null>(null)
  const [previewPending, setPreviewPending] = useState(false)
  const previewAbort = useRef<AbortController | null>(null)

  const consentGiven = Boolean(automation.consent_confirmed_at)

  async function onSubmit(values: AutomationFormValues) {
    try {
      const next = await saveAutomation(type, { connection_id: connectionId, ...bodyFromValues(type, values) })
      form.reset(formValuesFrom(next))
      setPreview(null)
      onSaved(next)
      toast.success('Configurația a fost salvată')
    } catch (err) {
      // A 400 names the fields it refused: show them on the fields, not as one opaque toast.
      const fieldErrors = err instanceof CommerceApiError && err.status === 400 ? serverFieldErrors(err.details) : []
      for (const { field, message } of fieldErrors) form.setError(field, { type: 'server', message })
      if (fieldErrors.length) form.setFocus(fieldErrors[0].field)
      toast.error('Configurația nu a putut fi salvată', {
        description: fieldErrors.length ? 'Verifică câmpurile marcate și încearcă din nou.' : commerceErrorMessage(err, 'Verifică datele și încearcă din nou.'),
      })
    }
  }

  async function confirmConsent() {
    if (!consentChecked) return
    setConsentPending(true)
    try {
      const next = await saveAutomation(type, { connection_id: connectionId, consent_confirmed: true })
      onSaved(next)
      toast.success('Acordul a fost confirmat', { description: 'Poți activa automatizarea după ce salvezi configurația.' })
    } catch (err) {
      toast.error('Acordul nu a putut fi confirmat', { description: commerceErrorMessage(err, 'Încearcă din nou.') })
    } finally {
      setConsentPending(false)
    }
  }

  async function runPreview() {
    previewAbort.current?.abort()
    const ctrl = new AbortController()
    previewAbort.current = ctrl
    setPreviewPending(true)
    try {
      const text = await fetchScriptPreview(type, connectionId, ctrl.signal)
      if (!ctrl.signal.aborted) setPreview({ text })
    } catch (err) {
      if (isAbortError(err)) return
      setPreview({ error: commerceErrorMessage(err, 'Previzualizarea nu a putut fi generată.') })
    } finally {
      if (previewAbort.current === ctrl) {
        previewAbort.current = null
        setPreviewPending(false)
      }
    }
  }

  /** Inserts `{{name}}` where the caret is (or at the end) and keeps the field dirty. */
  function insertVariable(name: string) {
    const el = templateRef.current
    const current = form.getValues('template')
    const token = `{{${name}}}`
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`
    form.setValue('template', next, { shouldDirty: true, shouldValidate: true })
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  const numberField = (name: 'delay_minutes' | 'daily_cap' | 'per_customer_daily_cap' | 'max_attempts' | 'retry_minutes') =>
    form.register(name, { valueAsNumber: true })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="divide-y-0">
      <FormSection as="h3" title="Când sună" description="Întârzierea după eveniment, fereastra de apel și zilele în care automatizarea poate suna.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Întârziere după eveniment (minute)"
            htmlFor={`${id}-delay`}
            error={errors.delay_minutes?.message}
            hint={type === 'abandoned_cart' ? `Cel puțin ${ABANDONED_CART_MIN_DELAY} de minute, ca să nu suni un client care încă finalizează.` : '0 = imediat ce comanda este eligibilă.'}
          >
            <Input id={`${id}-delay`} type="number" inputMode="numeric" min={type === 'abandoned_cart' ? ABANDONED_CART_MIN_DELAY : AUTOMATION_LIMITS.delay_minutes[0]} max={AUTOMATION_LIMITS.delay_minutes[1]} step={1} {...numberField('delay_minutes')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De la" htmlFor={`${id}-start`} error={errors.window_start?.message}>
              <Input id={`${id}-start`} type="time" step={60} {...form.register('window_start')} />
            </Field>
            <Field label="Până la" htmlFor={`${id}-end`} error={errors.window_end?.message}>
              <Input id={`${id}-end`} type="time" step={60} {...form.register('window_end')} />
            </Field>
          </div>
        </div>
        <DaysField control={form.control} id={`${id}-days`} error={errors.days?.message} />
        <TimezoneField control={form.control} id={`${id}-tz`} />
      </FormSection>

      <FormSection as="h3" title="Limite" description="Câte apeluri pe zi și câte încercări pentru aceeași comandă.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Apeluri pe zi (automatizare)" htmlFor={`${id}-daily`} error={errors.daily_cap?.message}>
            <Input id={`${id}-daily`} type="number" inputMode="numeric" min={AUTOMATION_LIMITS.daily_cap[0]} max={AUTOMATION_LIMITS.daily_cap[1]} step={1} {...numberField('daily_cap')} />
          </Field>
          <Field label="Apeluri pe zi, pe client" htmlFor={`${id}-per-customer`} error={errors.per_customer_daily_cap?.message} hint="Se aplică peste toate automatizările.">
            <Input id={`${id}-per-customer`} type="number" inputMode="numeric" min={AUTOMATION_LIMITS.per_customer_daily_cap[0]} max={AUTOMATION_LIMITS.per_customer_daily_cap[1]} step={1} {...numberField('per_customer_daily_cap')} />
          </Field>
          <Field label="Încercări per comandă" htmlFor={`${id}-attempts`} error={errors.max_attempts?.message} hint="1 = fără reîncercare.">
            <Input id={`${id}-attempts`} type="number" inputMode="numeric" min={AUTOMATION_LIMITS.max_attempts[0]} max={AUTOMATION_LIMITS.max_attempts[1]} step={1} {...numberField('max_attempts')} />
          </Field>
          <Field label="Minute între încercări" htmlFor={`${id}-retry`} error={errors.retry_minutes?.message} hint={`Între ${AUTOMATION_LIMITS.retry_minutes[0]} și ${AUTOMATION_LIMITS.retry_minutes[1]} de minute.`}>
            <Input id={`${id}-retry`} type="number" inputMode="numeric" min={AUTOMATION_LIMITS.retry_minutes[0]} max={AUTOMATION_LIMITS.retry_minutes[1]} step={5} {...numberField('retry_minutes')} />
          </Field>
        </div>
      </FormSection>

      <FormSection as="h3" title="Criterii" description="Ce comenzi sau coșuri intră în această automatizare.">
        {type === 'cod_confirmation' && <PaymentMethodsField control={form.control} id={`${id}-cod`} error={errors.cod_payment_methods?.message} />}
        {type === 'order_follow_up' && <FollowUpStatusField control={form.control} id={`${id}-follow` } />}
        {type === 'abandoned_cart' && (
          <Field label="Valoarea minimă a coșului" htmlFor={`${id}-min-total`} optional error={errors.min_order_total?.message} hint="Coșurile sub această sumă nu sunt sunate. Gol = orice coș.">
            <Input id={`${id}-min-total`} type="text" inputMode="decimal" placeholder="150" className="max-w-xs" {...form.register('min_order_total')} />
          </Field>
        )}
      </FormSection>

      <FormSection as="h3" title="Script" description="Ce spune agentul. Variabilele dintre acolade sunt înlocuite cu datele comenzii la fiecare apel.">
        <Field label="Scriptul apelului" htmlFor={`${id}-template`} error={errors.template?.message}>
          <Textarea
            id={`${id}-template`}
            rows={8}
            className="min-h-40"
            spellCheck
            {...templateField}
            ref={(el) => {
              templateField.ref(el)
              templateRef.current = el
            }}
          />
        </Field>
        <div className="rounded-2xl bg-secondary p-4">
          <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Variabile disponibile</p>
          <ul className="mt-2.5 space-y-2">
            {SCRIPT_VARIABLES.map((variable) => (
              <li key={variable.name} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-[13px] leading-[19px]">
                <Button type="button" variant="outline" size="xs" className="font-mono" onClick={() => insertVariable(variable.name)} aria-label={`Inserează variabila ${variable.name}`}>
                  {`{{${variable.name}}}`}
                </Button>
                <span className="min-w-0 flex-1 text-foreground/80">{variable.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void runPreview()} loading={previewPending} loadingState="composing" loadingText="Se generează…">
              <Eye aria-hidden="true" />
              Previzualizează cu date de probă
            </Button>
            {isDirty && <p className="text-xs leading-4 text-muted-foreground">Previzualizarea folosește scriptul salvat; salvează ca să includă modificările.</p>}
          </div>
          {preview && 'text' in preview && (
            <div className="rounded-2xl bg-white p-4 shadow-hair" role="status">
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Previzualizare</p>
              <p className="mt-2 text-sm leading-[22px] whitespace-pre-line text-foreground">{preview.text}</p>
            </div>
          )}
          {preview && 'error' in preview && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive-soft p-4 text-[13px] leading-[19px] text-destructive">
              <p>{preview.error}</p>
              <Button type="button" variant="outline" size="xs" onClick={() => void runPreview()}>
                <RotateCw aria-hidden="true" />
                Încearcă din nou
              </Button>
            </div>
          )}
        </div>
        <ToneField control={form.control} id={`${id}-tone`} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Numele brandului" htmlFor={`${id}-brand`} optional error={errors.brand_name?.message} hint="Cum se prezintă agentul; gol = numele magazinului din profil.">
            <Input id={`${id}-brand`} maxLength={100} autoComplete="organization" {...form.register('brand_name')} />
          </Field>
          <Field label="Număr pentru transfer" htmlFor={`${id}-transfer`} optional error={errors.transfer_number?.message} hint="Agentul poate preda apelul aici; gol = fără transfer.">
            <Input id={`${id}-transfer`} type="tel" inputMode="tel" placeholder="+40712345678" autoComplete="off" {...form.register('transfer_number')} />
          </Field>
        </div>
        <Field label="Politica de retur (adresă)" htmlFor={`${id}-return`} optional error={errors.return_policy_url?.message}>
          <Input id={`${id}-return`} type="url" inputMode="url" placeholder="https://magazinul-tau.ro/retur" autoComplete="off" {...form.register('return_policy_url')} />
        </Field>
      </FormSection>

      <FormSection as="h3" title="Acordul clienților" description="Fără această confirmare, automatizarea nu poate fi activată.">
        {consentGiven ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary p-4">
            <StatusChip tone="success" icon={<ShieldCheck aria-hidden="true" />}>Acord confirmat</StatusChip>
            <p className="text-[13px] leading-[19px] text-muted-foreground">
              Confirmat la <span className="text-foreground tabular-nums">{formatDateTime(automation.consent_confirmed_at)}</span>
              {automation.consent_version && <span> · versiunea {automation.consent_version}</span>}
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-secondary p-4">
            <div className="flex items-start gap-3">
              <Checkbox id={`${id}-consent`} checked={consentChecked} onCheckedChange={(v) => setConsentChecked(Boolean(v))} disabled={consentPending} className="mt-px" />
              <label htmlFor={`${id}-consent`} className="text-[13px] leading-[19px] text-foreground select-none">
                {CONSENT_TEXT}
              </label>
            </div>
            <Button type="button" size="sm" onClick={() => void confirmConsent()} disabled={!consentChecked} loading={consentPending} loadingText="Se confirmă…">
              <Check aria-hidden="true" />
              Confirmă acordul
            </Button>
          </div>
        )}
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
        <p className="text-[13px] leading-[19px] text-muted-foreground" aria-live="polite">
          {isDirty ? (
            <span className="flex items-center gap-2">
              <OrbInline state="breathing" />
              Modificări nesalvate
            </span>
          ) : (
            'Configurația este salvată.'
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => form.reset(formValuesFrom(automation))} disabled={!isDirty || isSubmitting}>
            Renunță la modificări
          </Button>
          <Button type="submit" loading={isSubmitting} loadingText="Se salvează…" disabled={!isDirty && Boolean(automation.id)}>
            <Save aria-hidden="true" />
            {automation.id ? 'Salvează' : 'Salvează configurația'}
          </Button>
        </div>
      </div>
    </form>
  )
}
