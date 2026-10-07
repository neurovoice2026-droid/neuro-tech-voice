import 'server-only'
// ElevenLabs speech history (GET /v1/history, DELETE /v1/history/{id}),
// verified against the official OpenAPI spec (2026-10). The history is
// WORKSPACE-wide: it holds every tenant's previews, so it is read by the
// platform only (retention and voice-deletion purges) and never proxied.

import { req, type Ctx } from '../client'

/** GET /v1/history page_size cap ("Can not exceed 1000"). */
export const HISTORY_MAX_PAGE_SIZE = 1000

/** SpeechHistoryItemResponseModel (subset; the text is never read or logged). */
export interface ELHistoryItem {
  history_item_id: string
  voice_id?: string | null
  model_id?: string | null
  voice_category?: string | null
  date_unix: number
  source?: string | null
  state?: 'created' | 'deleted' | 'processing'
}

export interface ELHistoryPage {
  history: ELHistoryItem[]
  last_history_item_id?: string | null
  has_more: boolean
}

export function listHistory(params: {
  page_size?: number
  start_after_history_item_id?: string | null
  voice_id?: string
  date_before_unix?: number
  date_after_unix?: number
  /** Source enum of the query parameter: TTS | STS | Flows. */
  source?: 'TTS' | 'STS' | 'Flows'
}, ctx?: Ctx) {
  return req<ELHistoryPage>('history.list', '/v1/history', {
    query: {
      page_size: Math.min(params.page_size ?? 100, HISTORY_MAX_PAGE_SIZE),
      start_after_history_item_id: params.start_after_history_item_id ?? undefined,
      voice_id: params.voice_id,
      date_before_unix: params.date_before_unix,
      date_after_unix: params.date_after_unix,
      source: params.source,
    },
    ctx,
  })
}

/** DELETE /v1/history/{id}. Irreversible; re-deleting is harmless (a 404 counts as done for callers). */
export function deleteHistoryItem(historyItemId: string, ctx?: Ctx) {
  return req<{ status: string }>('history.delete', `/v1/history/${encodeURIComponent(historyItemId)}`, { method: 'DELETE', ctx })
}
