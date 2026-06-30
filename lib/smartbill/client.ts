// ─── SmartBill Cloud API Client ──────────────────────────────────────────────
// Wrapper for the SmartBill REST API (https://ws.smartbill.ro/SBORO/api).
// Auth is HTTP Basic: username = SmartBill account email, password = API token
// (found in SmartBill → Contul meu → Integrari → API). We use it to emit fiscal
// invoices automatically when a Stripe payment succeeds.

const BASE = 'https://ws.smartbill.ro/SBORO/api'

/** True when SmartBill credentials + issuing config are all present. */
export function isConfigured(): boolean {
  return (
    !!process.env.SMARTBILL_USERNAME &&
    !!process.env.SMARTBILL_TOKEN &&
    !!process.env.SMARTBILL_COMPANY_VAT_CODE &&
    !!process.env.SMARTBILL_SERIES
  )
}

export class SmartBillError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`SmartBill API error ${status} on ${path}: ${body}`)
    this.name = 'SmartBillError'
  }
}

function authHeader(): string {
  const user = process.env.SMARTBILL_USERNAME ?? ''
  const token = process.env.SMARTBILL_TOKEN ?? ''
  return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new SmartBillError(res.status, text, path)
  }

  // SmartBill returns JSON; some errors come back HTTP 200 with an errorText field.
  let json: unknown = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    throw new SmartBillError(res.status, text, path)
  }

  const errorText = (json as { errorText?: string }).errorText
  if (errorText) {
    throw new SmartBillError(res.status, errorText, path)
  }

  return json as T
}

// ─── Invoice types ────────────────────────────────────────────────────────────

export interface SmartBillClientData {
  /** Legal name of the buyer (company or person). */
  name: string
  /** Buyer fiscal code (CUI / CIF) — for B2B. Omit for individuals. */
  vatCode?: string
  /** Registry number (Nr. Reg. Com.), optional. */
  regCom?: string
  address?: string
  city?: string
  county?: string
  country?: string
  email?: string
  /** Whether the buyer is a VAT payer. */
  isTaxPayer?: boolean
  /** Persist this client in the SmartBill nomenclator. */
  saveToDb?: boolean
}

export interface SmartBillProduct {
  name: string
  code?: string
  isDiscount?: boolean
  measuringUnitName?: string
  currency: string
  quantity: number
  price: number
  /** When true, `price` is gross (TVA included). */
  isTaxIncluded?: boolean
  taxName?: string
  taxPercentage?: number
  saveToDb?: boolean
  isService?: boolean
}

export interface SmartBillPayment {
  value: number
  /** e.g. "Card", "Ordin de plata", "Numerar". */
  type?: string
  isCash?: boolean
}

export interface CreateInvoiceParams {
  /** Seller fiscal code (our company CUI). */
  companyVatCode: string
  client: SmartBillClientData
  issueDate: string // YYYY-MM-DD
  dueDate?: string
  deliveryDate?: string
  seriesName: string
  isDraft?: boolean
  currency: string
  language?: string // "RO" | "EN"
  precision?: number
  useStock?: boolean
  products: SmartBillProduct[]
  /** When present, the invoice is recorded as paid (încasată). */
  payment?: SmartBillPayment
  mentions?: string
  observations?: string
}

export interface CreateInvoiceResponse {
  number: string
  series: string
  message?: string
  url?: string
  [key: string]: unknown
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = {
  /** Emit a fiscal invoice. Returns the assigned series + number. */
  create(params: CreateInvoiceParams) {
    return request<CreateInvoiceResponse>('POST', '/invoice', params)
  },

  /** Reverse (storno) an invoice via a credit note. */
  reverse(params: { companyVatCode: string; seriesName: string; number: string; issueDate: string }) {
    return request<CreateInvoiceResponse>('POST', '/invoice/reverse', params)
  },

  /** Permanently delete an invoice (only allowed for the most recent in a series). */
  delete(params: { companyVatCode: string; seriesName: string; number: string }) {
    const qs = new URLSearchParams({
      cif: params.companyVatCode,
      seriesname: params.seriesName,
      number: params.number,
    })
    return request<void>('DELETE', `/invoice?${qs.toString()}`)
  },
}
