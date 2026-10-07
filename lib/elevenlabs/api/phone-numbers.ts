import 'server-only'
// Imported phone numbers: the paginated, filterable lookup. Verified against
// the official OpenAPI spec (2026-10):
//
//   GET /v1/convai/v2/phone-numbers
//     page_size 1–1000 (default 100), search, label (case-insensitive
//     substring), phone_number, provider (twilio | sip_trunk | exotel),
//     supports_outbound, agent_id, branch_id, sort_by (label | phone_number),
//     sort_direction (asc | desc), cursor
//     → GetPhoneNumbersPageResponseModel {phone_numbers*, next_cursor, has_more}
//       phone_numbers[]: GetPhoneNumber{Twilio|Exotel|SIPTrunk}ResponseModel
//       {phone_number*, label*, phone_number_id*, provider, assigned_agent:
//        PhoneNumberAgentInfo {agent_id*, agent_name*, environment, branch_id} | null}
//
// The listing is WORKSPACE-WIDE: every tenant's imports live in the one shared
// workspace. It is used by platform code only (idempotent import adoption in
// lib/telephony/binding.ts, the admin orphan report), always narrowed to one
// number or to this deployment's label prefix, and never returned to a tenant.
// The unfiltered v1 listing (GET /v1/convai/phone-numbers) is deliberately
// not wrapped anywhere.

import { normalizeE164 } from '@/lib/phone/e164'
import { req, type Ctx } from '../client'

const PATH = '/v1/convai/v2/phone-numbers'

/** TelephonyProvider. */
export type TelephonyProvider = 'twilio' | 'sip_trunk' | 'exotel'

/** One imported number (the fields of the three response models the platform reads). */
export interface ELImportedNumber {
  phone_number_id: string
  phone_number: string
  label: string
  provider?: TelephonyProvider | string
  assigned_agent?: { agent_id: string; agent_name?: string; branch_id?: string | null } | null
}

export interface ELImportedNumbersPage {
  phone_numbers: ELImportedNumber[]
  next_cursor?: string | null
  has_more?: boolean
}

export interface ListImportedNumbersParams {
  /** Filter by phone number (exact matching is done by the caller). */
  phone_number?: string
  /** Case-insensitive substring of the label. */
  label?: string
  agent_id?: string
  provider?: TelephonyProvider
  cursor?: string | null
  /** 1–100 here (the API allows up to 1000; pages stay small). */
  page_size?: number
}

const clip = (v: string | undefined) => (v === undefined ? undefined : v.slice(0, 100))

/** One page of imported numbers (GET, retried on transient failures). */
export function listImportedNumbersPage(params: ListImportedNumbersParams = {}, ctx?: Ctx) {
  return req<ELImportedNumbersPage>('phone_numbers.list_page', PATH, {
    query: {
      phone_number: clip(params.phone_number),
      label: clip(params.label),
      agent_id: params.agent_id,
      provider: params.provider,
      cursor: params.cursor ?? undefined,
      page_size: Math.max(1, Math.min(100, Math.floor(params.page_size ?? 100))),
    },
    ctx,
  })
}

/**
 * The Twilio import of exactly this E.164 number, or null. The provider's
 * phone_number filter is not documented as exact, so every candidate is
 * compared after normalization; at most `maxPages` pages are read.
 */
export async function findImportedNumber(e164: string, opts: { ctx?: Ctx; maxPages?: number } = {}): Promise<ELImportedNumber | null> {
  const wanted = normalizeE164(e164)
  if (!wanted) return null
  let cursor: string | null = null
  for (let page = 0; page < (opts.maxPages ?? 3); page++) {
    const res: ELImportedNumbersPage = await listImportedNumbersPage({ phone_number: wanted, provider: 'twilio', cursor, page_size: 100 }, opts.ctx)
    const hit = (res.phone_numbers ?? []).find((n) => normalizeE164(n.phone_number ?? '') === wanted)
    if (hit) return hit
    cursor = res.has_more && res.next_cursor ? res.next_cursor : null
    if (!cursor) return null
  }
  return null
}

/**
 * Every import whose label contains `label` (case-insensitive substring),
 * paging to the end or to `maxPages`. `truncated` = the cap was hit: callers
 * must not draw "missing" conclusions from a truncated listing.
 */
export async function collectImportedNumbers(
  params: { label: string },
  opts: { ctx?: Ctx; maxPages?: number } = {},
): Promise<{ numbers: ELImportedNumber[]; truncated: boolean }> {
  const out: ELImportedNumber[] = []
  let cursor: string | null = null
  const maxPages = opts.maxPages ?? 20
  for (let page = 0; page < maxPages; page++) {
    const res: ELImportedNumbersPage = await listImportedNumbersPage({ label: params.label, cursor, page_size: 100 }, opts.ctx)
    out.push(...(res.phone_numbers ?? []))
    cursor = res.has_more && res.next_cursor ? res.next_cursor : null
    if (!cursor) return { numbers: out, truncated: false }
  }
  return { numbers: out, truncated: true }
}
