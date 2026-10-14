'use client'

// The connect form of a credentials platform (WooCommerce, Magento,
// PrestaShop, custom API): the catalog's fields, secrets as password inputs.
// Secrets live only in this form's field state; they are sent once with
// POST /api/commerce/connections and cleared as soon as the request ends.

import { useRef, useState } from 'react'
import { useController, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ExternalLink, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/shared/FormSection'
import type { ConnectField, PlatformDescriptor } from '@/lib/commerce/platforms'
import type { ConnectionDto } from '@/lib/commerce/types'
import { commerceErrorMessage, requestJson } from './api'
import { FormSelect } from './fields'
import { ErrorBlock } from './shared'

/** The route reaches the store, checks the keys and registers webhooks before it answers. */
const CONNECT_TIMEOUT_MS = 90_000

const CONNECT_FAILED = 'The store could not be connected.'

type FormValues = Record<string, string>

function isHttpsUrl(value: string): boolean {
  return URL.canParse(value) && new URL(value).protocol === 'https:'
}

/** One zod rule per catalog field: required, https for URLs, a listed option for selects. */
function buildSchema(fields: ConnectField[]) {
  const shape: Record<string, z.ZodType<string>> = {}
  for (const f of fields) {
    let rule = z.string().trim()
    if (f.type === 'url') rule = rule.refine((v) => !v || isHttpsUrl(v), 'Enter an address that starts with https://')
    if (f.type === 'select') rule = rule.refine((v) => !v || (f.options ?? []).some((o) => o.value === v), 'Choose an option')
    shape[f.key] = f.required ? rule.refine((v) => v.length > 0, 'This field is required') : rule
  }
  return z.object(shape)
}

interface CredentialsFormProps {
  descriptor: PlatformDescriptor
  /** The store name entered at step 1, sent as the connection's display name. */
  displayName: string
  onConnected: (connection: ConnectionDto) => void
}

export function CredentialsForm({ descriptor, displayName, onConnected }: CredentialsFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstSecretRef = useRef<HTMLInputElement | null>(null)

  const defaults: FormValues = {}
  for (const f of descriptor.fields) defaults[f.key] = f.type === 'select' ? (f.options?.[0]?.value ?? '') : ''

  const form = useForm<FormValues>({
    // The schema is built from the catalog, so its field set is only known at runtime.
    resolver: zodResolver(buildSchema(descriptor.fields)) as Resolver<FormValues>,
    defaultValues: defaults,
  })
  const { errors } = form.formState
  const secretKeys = descriptor.fields.filter((f) => f.type === 'secret').map((f) => f.key)

  function clearSecrets() {
    for (const key of secretKeys) form.resetField(key, { defaultValue: '' })
  }

  async function onSubmit(values: FormValues) {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const { store_url, ...rest } = values
    const secrets: Record<string, string> = {}
    for (const [key, value] of Object.entries(rest)) if (value) secrets[key] = value
    try {
      const data = await requestJson<{ connection: ConnectionDto }>('/api/commerce/connections', {
        method: 'POST',
        body: { platform: descriptor.id, store_url, display_name: displayName || undefined, secrets },
        fallback: CONNECT_FAILED,
        timeoutMs: CONNECT_TIMEOUT_MS,
      })
      onConnected(data.connection)
    } catch (err) {
      setError(commerceErrorMessage(err, CONNECT_FAILED))
    } finally {
      // Never shown again, whatever the outcome: the keys are typed afresh on a retry.
      clearSecrets()
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
      <section aria-labelledby="connect-instructions-title" className="rounded-2xl bg-secondary p-5">
        <h3 id="connect-instructions-title" className="text-[13px] leading-[19px] font-medium text-foreground">
          How to get your access keys
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-[19px] text-muted-foreground">
          {descriptor.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <a
          href={descriptor.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] leading-[19px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
        >
          Documentation
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </section>

      <div className="space-y-6">
        {descriptor.fields.map((f) => (
          <CatalogField
            key={f.key}
            field={f}
            form={form}
            error={errors[f.key]?.message}
            disabled={submitting}
            inputRef={f.type === 'secret' && f.key === secretKeys[0] ? firstSecretRef : undefined}
          />
        ))}
      </div>

      {error && (
        <ErrorBlock
          title="The connection failed"
          message={`${error} The keys you entered were cleared from the form; enter them again and retry.`}
          onRetry={() => firstSecretRef.current?.focus()}
          retryLabel="Re-enter the keys"
        />
      )}

      <Button type="submit" size="lg" loading={submitting} loadingState="connecting" loadingText="Connecting…" className="w-full sm:w-auto">
        <Plug aria-hidden="true" />
        Connect store
      </Button>
    </form>
  )
}

interface CatalogFieldProps {
  field: ConnectField
  form: ReturnType<typeof useForm<FormValues>>
  error?: string
  disabled?: boolean
  inputRef?: React.MutableRefObject<HTMLInputElement | null>
}

function CatalogField({ field, form, error, disabled, inputRef }: CatalogFieldProps) {
  const id = `connect-${field.key}`
  if (field.type === 'select') {
    return <SelectCatalogField field={field} form={form} error={error} disabled={disabled} id={id} />
  }
  const registration = form.register(field.key)
  return (
    <Field label={field.label} htmlFor={id} optional={!field.required} hint={field.help} error={error}>
      <Input
        id={id}
        type={field.type === 'secret' ? 'password' : field.type === 'url' ? 'url' : 'text'}
        inputMode={field.type === 'url' ? 'url' : undefined}
        autoComplete={field.type === 'secret' ? 'new-password' : 'off'}
        spellCheck={false}
        placeholder={field.placeholder}
        disabled={disabled}
        {...registration}
        ref={(el) => {
          registration.ref(el)
          if (inputRef) inputRef.current = el
        }}
        className="h-11"
      />
    </Field>
  )
}

function SelectCatalogField({ field, form, error, disabled, id }: Omit<CatalogFieldProps, 'inputRef'> & { id: string }) {
  const { field: control } = useController({ control: form.control, name: field.key })
  return (
    <Field label={field.label} htmlFor={id} optional={!field.required} hint={field.help} error={error}>
      <FormSelect
        id={id}
        value={control.value ?? ''}
        onChange={control.onChange}
        options={field.options ?? []}
        invalid={!!error}
        describedBy={[field.help ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined}
        disabled={disabled}
        triggerRef={control.ref}
      />
    </Field>
  )
}
