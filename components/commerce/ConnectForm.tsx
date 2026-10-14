'use client'

import { useId, useState } from 'react'
import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ExternalLink, KeyRound, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/shared/FormSection'
import { CommerceApiError, commerceErrorMessage } from '@/hooks/useCommerceApi'
import { createConnection, shopifyStartUrl } from '@/hooks/useCommerceConnections'
import { PLATFORM_CATALOG, type ConnectField } from '@/lib/commerce/platforms'
import type { CommercePlatform, ConnectionDto } from '@/lib/commerce/types'
import { clearSecrets, connectSchema, initialConnectValues, normalizeShopDomain, splitConnectValues, type ConnectValues } from './connect-schema'

// The connect form, shared by the first connection and "Reconectează": its
// fields come from PLATFORM_CATALOG. Secrets are password inputs, never
// echoed back, cleared the moment the request returns (success or not), and
// never kept anywhere but in the form's own state.

interface ConnectFormProps {
  platform: CommercePlatform
  mode: 'connect' | 'reconnect'
  /** Non-secret prefill (the store URL / domain of the connection being reconnected). */
  prefill?: { store_url?: string; display_name?: string | null }
  onConnected: (connection: ConnectionDto) => void
  onCancel?: () => void
  /** Where the Shopify callback brings the browser back. */
  returnTo?: 'onboarding' | 'magazin'
}

interface FormError {
  title: string
  message: string
}

function describeFailure(err: unknown): FormError {
  if (err instanceof CommerceApiError) {
    if (err.status === 503 && err.code === 'not_configured') {
      return { title: 'Platforma nu este pregătită', message: err.message }
    }
    if (err.status === 409) return { title: 'Magazinul nu a răspuns cum trebuie', message: err.message }
    if (err.status === 400) return { title: 'Verifică datele introduse', message: err.message }
    return { title: 'Conectarea a eșuat', message: err.message }
  }
  return { title: 'Conectarea a eșuat', message: commerceErrorMessage(err, 'Încearcă din nou.') }
}

function Instructions({ platform }: { platform: CommercePlatform }) {
  const descriptor = PLATFORM_CATALOG[platform]
  const external = /^https?:\/\//.test(descriptor.docsUrl)
  return (
    <div className="rounded-2xl bg-secondary p-4">
      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Cum obții accesul</p>
      <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[13px] leading-[19px] text-foreground/80">
        {descriptor.instructions.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a
        href={descriptor.docsUrl}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        Documentația {descriptor.name}
        {external && <ExternalLink className="size-3.5" aria-hidden="true" />}
      </a>
    </div>
  )
}

/** Shopify: the browser leaves for the OAuth consent page; nothing is posted from here. */
function ShopifyForm({ mode, prefill, onCancel, returnTo = 'magazin' }: Omit<ConnectFormProps, 'platform' | 'onConnected'>) {
  const id = useId()
  const [domain, setDomain] = useState(prefill?.store_url ? (normalizeShopDomain(prefill.store_url) ?? '') : '')
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const shop = normalizeShopDomain(domain)
    if (!shop) {
      setError('Introdu domeniul magazinului, de forma magazinul-tau.myshopify.com')
      return
    }
    setError(null)
    setLeaving(true)
    window.location.assign(shopifyStartUrl(shop, returnTo))
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Instructions platform="shopify" />
      <Field label="Domeniul magazinului" htmlFor={`${id}-shop`} error={error} hint="Domeniul myshopify.com, nu cel personalizat al magazinului.">
        <Input
          id={`${id}-shop`}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="magazinul-tau.myshopify.com"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          disabled={leaving}
          className="h-11"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={leaving}>
            Renunță
          </Button>
        )}
        <Button type="submit" loading={leaving} loadingState="connecting" loadingText="Te trimitem în Shopify…">
          {mode === 'reconnect' ? 'Reautorizează în Shopify' : 'Continuă în Shopify'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}

function SelectField({ field, control, id, error, disabled }: {
  field: ConnectField
  control: ReturnType<typeof useForm<ConnectValues>>['control']
  id: string
  error?: string
  disabled: boolean
}) {
  const { field: ctl } = useController({ control, name: field.key })
  const options = field.options ?? []
  return (
    <Field label={field.label} htmlFor={id} error={error} hint={field.help} optional={!field.required}>
      <Select value={ctl.value} onValueChange={(v) => v && ctl.onChange(String(v))} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-invalid={error ? true : undefined}>
          <SelectValue>{(value: string) => options.find((o) => o.value === value)?.label ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function CredentialsForm({ platform, mode, prefill, onConnected, onCancel }: ConnectFormProps) {
  const id = useId()
  const descriptor = PLATFORM_CATALOG[platform]
  const fields = descriptor.fields
  const [failure, setFailure] = useState<FormError | null>(null)
  const [displayName, setDisplayName] = useState(prefill?.display_name ?? '')

  const form = useForm<ConnectValues>({
    resolver: zodResolver(connectSchema(fields)),
    defaultValues: initialConnectValues(fields, { store_url: prefill?.store_url ?? '' }),
  })
  const { errors, isSubmitting } = form.formState
  const authScheme = form.watch('auth_scheme')

  async function onSubmit(values: ConnectValues) {
    setFailure(null)
    const { store_url, secrets } = splitConnectValues(fields, values)
    try {
      const connection = await createConnection({
        platform,
        store_url,
        ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
        secrets,
      })
      onConnected(connection)
    } catch (err) {
      setFailure(describeFailure(err))
    } finally {
      // The keys were sent once; the form never shows or keeps them again.
      form.reset(clearSecrets(fields, values))
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5" autoComplete="off">
      <Instructions platform={platform} />

      {failure && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{failure.title}</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      )}

      <Field label="Nume afișat" htmlFor={`${id}-display`} optional hint="Cum apare magazinul în panou (implicit, domeniul).">
        <Input
          id={`${id}-display`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
          autoComplete="organization"
          disabled={isSubmitting}
          className="h-11"
        />
      </Field>

      {fields.map((field) => {
        const fieldId = `${id}-${field.key}`
        const error = errors[field.key]?.message
        if (field.type === 'select') {
          return <SelectField key={field.key} field={field} control={form.control} id={fieldId} error={error} disabled={isSubmitting} />
        }
        // The header name only applies to the "key in header" scheme.
        if (field.key === 'auth_header_name' && authScheme !== 'api_key_header') return null
        const secret = field.type === 'secret'
        return (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={fieldId}
            error={error}
            optional={!field.required}
            hint={secret ? `${field.help ? `${field.help} ` : ''}Nu va mai fi afișat după salvare.` : field.help}
          >
            <div className="relative">
              {secret && (
                <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              )}
              <Input
                id={fieldId}
                type={secret ? 'password' : field.type === 'url' ? 'url' : 'text'}
                inputMode={field.type === 'url' ? 'url' : undefined}
                placeholder={field.placeholder}
                autoComplete={secret ? 'new-password' : 'off'}
                spellCheck={false}
                disabled={isSubmitting}
                {...form.register(field.key)}
                className={secret ? 'h-11 pl-10' : 'h-11'}
              />
            </div>
          </Field>
        )
      })}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Renunță
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} loadingState="connecting" loadingText="Se verifică accesul…">
          {mode === 'reconnect' ? 'Reconectează' : 'Conectează magazinul'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}

export function ConnectForm(props: ConnectFormProps) {
  const descriptor = PLATFORM_CATALOG[props.platform]
  if (descriptor.connectMode === 'oauth') {
    const { mode, prefill, onCancel, returnTo } = props
    return <ShopifyForm mode={mode} prefill={prefill} onCancel={onCancel} returnTo={returnTo} />
  }
  return <CredentialsForm key={props.platform} {...props} />
}
