'use client'

import { useCallback } from 'react'
import type { AutomationConfig, AutomationDto, AutomationScript, AutomationType } from '@/lib/commerce/types'
import { ENABLE_BLOCKED_REASON } from '@/components/commerce/labels'
import { CommerceApiError, buildQuery, commerceRequest, useCommerceQuery } from './useCommerceApi'

/** GET /api/commerce/automations?connection_id (always the three templates; unconfigured ones have no id). */
export function useCommerceAutomations(connectionId: string | null) {
  const path = connectionId ? `/api/commerce/automations?${buildQuery({ connection_id: connectionId })}` : null
  const query = useCommerceQuery<{ items: AutomationDto[] }>(path, { fallback: 'Automations could not be loaded.' })
  const { setData } = query

  const replaceAutomation = useCallback(
    (automation: AutomationDto) =>
      setData((prev) => (prev ? { items: prev.items.map((a) => (a.type === automation.type ? automation : a)) } : prev)),
    [setData],
  )

  return { automations: query.data?.items ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch, replaceAutomation }
}

export interface AutomationSaveBody {
  connection_id: string
  enabled?: boolean
  config?: Partial<AutomationConfig>
  script?: Partial<AutomationScript>
  consent_confirmed?: true
}

/** PUT /api/commerce/automations/[type]; the server's row comes back. */
export async function saveAutomation(type: AutomationType, body: AutomationSaveBody): Promise<AutomationDto> {
  const res = await commerceRequest<{ automation: AutomationDto }>(`/api/commerce/automations/${encodeURIComponent(type)}`, {
    method: 'PUT',
    json: body,
    fallback: 'The automation could not be saved.',
  })
  return res.automation
}

export interface EnableBlocked {
  message: string
  href: string | null
  action: string | null
}

/** A 409 on enabling, as the route worded it, with the page that fixes it when the reason is known; null for any other error. */
export function enableBlocked(err: unknown): EnableBlocked | null {
  if (!(err instanceof CommerceApiError) || err.status !== 409) return null
  const reason = err.reason
  const link = reason && Object.hasOwn(ENABLE_BLOCKED_REASON, reason) ? ENABLE_BLOCKED_REASON[reason] : { href: null, action: null }
  return { message: err.message, ...link }
}

/** GET /api/commerce/script-preview: the saved script with sample values resolved. */
export async function fetchScriptPreview(type: AutomationType, connectionId: string, signal?: AbortSignal): Promise<string> {
  const res = await commerceRequest<{ text: string }>(`/api/commerce/script-preview?${buildQuery({ type, connection_id: connectionId })}`, {
    signal,
    fallback: 'The script preview could not be generated.',
  })
  return res.text
}
