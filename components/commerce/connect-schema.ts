// The connect form's validation, derived from a platform's field list in
// PLATFORM_CATALOG (lib/commerce/platforms.ts) so the form and the catalog
// cannot drift. Pure (zod only), shared by the connect and reconnect dialogs
// and unit-tested in tests/commerce-ui-schemas.

import { z } from 'zod'
import type { ConnectField } from '@/lib/commerce/platforms'

export type ConnectValues = Record<string, string>

/** The message under the Shopify domain field when the value is not a myshopify.com host. */
export const SHOP_DOMAIN_ERROR = 'Enter the store domain in the form your-store.myshopify.com'

function isHttpsUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return url.protocol === 'https:' && url.hostname.includes('.')
}

/** myshopify.com host, with or without a scheme, as the merchant may paste it. */
export function normalizeShopDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value) return null
  if (/^https?:\/\//.test(value)) {
    if (!URL.canParse(value)) return null
    value = new URL(value).hostname
  }
  value = value.replace(/\/.*$/, '')
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) return null
  return value
}

export function connectSchema(fields: ReadonlyArray<ConnectField>): z.ZodType<ConnectValues, ConnectValues> {
  const shape: Record<string, z.ZodType<string>> = {}
  for (const field of fields) {
    let schema = z.string().trim()
    if (field.required) schema = schema.min(1, `${field.label} is required`)
    if (field.type === 'url') {
      schema = schema.refine((v) => v === '' || isHttpsUrl(v), 'The address must start with https:// and be a valid domain')
    }
    if (field.key === 'shop_domain') {
      schema = schema.refine((v) => v === '' || normalizeShopDomain(v) !== null, SHOP_DOMAIN_ERROR)
    }
    shape[field.key] = schema
  }
  const keys = new Set(fields.map((f) => f.key))
  const object = z.object(shape).superRefine((values, ctx) => {
    // The custom connector's header name only matters for the header scheme (and is then required).
    if (keys.has('auth_scheme') && keys.has('auth_header_name') && values.auth_scheme === 'api_key_header' && !values.auth_header_name) {
      ctx.addIssue({ code: 'custom', path: ['auth_header_name'], message: 'The header name is required for API-key-in-header authentication' })
    }
  })
  return object as unknown as z.ZodType<ConnectValues, ConnectValues>
}

export function isSecretField(field: ConnectField): boolean {
  return field.type === 'secret'
}

/** Blank values for every field, with a prefill for the non-secret ones (reconnect keeps the store URL). */
export function initialConnectValues(fields: ReadonlyArray<ConnectField>, prefill: Partial<ConnectValues> = {}): ConnectValues {
  const out: ConnectValues = {}
  for (const field of fields) {
    const given = prefill[field.key]
    out[field.key] = !isSecretField(field) && typeof given === 'string' ? given : field.type === 'select' ? field.options?.[0]?.value ?? '' : ''
  }
  return out
}

/** The POST /api/commerce/connections body parts: the store URL and every other non-empty field as a secret. */
export function splitConnectValues(fields: ReadonlyArray<ConnectField>, values: ConnectValues): { store_url: string; secrets: Record<string, string> } {
  const secrets: Record<string, string> = {}
  let store_url = ''
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim()
    if (field.key === 'store_url') {
      store_url = value
      continue
    }
    if (value) secrets[field.key] = value
  }
  return { store_url, secrets }
}

/** The same values with every secret blanked, for resetting the form after a submit. */
export function clearSecrets(fields: ReadonlyArray<ConnectField>, values: ConnectValues): ConnectValues {
  const out: ConnectValues = { ...values }
  for (const field of fields) if (isSecretField(field)) out[field.key] = ''
  return out
}
