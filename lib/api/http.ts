import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { E164_REGEX } from '@/lib/phone/e164'

// Shared plumbing for route handlers: one error shape everywhere
// ({ error: { code, message } }), bounded JSON bodies and zod validation.

export const DEFAULT_MAX_JSON_BYTES = 64 * 1024

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly headers: Record<string, string> | undefined

  constructor(status: number, code: string, message: string, headers?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.headers = headers
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers })
}

/** Short, log-greppable reference shown to the user on unexpected errors. */
export function createRequestId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

/** "Invalid request. body.name: Too short; to_number: Invalid" (first five issues). */
export function formatZodIssues(error: z.core.$ZodError): string {
  const parts = error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
  const more = error.issues.length > 5 ? ` (+${error.issues.length - 5} more)` : ''
  return `Invalid request. ${parts.join('; ')}${more}`
}

export function validationError(error: z.core.$ZodError): ApiError {
  return new ApiError(400, 'validation_error', formatZodIssues(error))
}

/**
 * Wraps a route handler so every failure leaves as the standard error body.
 * Next.js control-flow errors (redirect(), notFound(), dynamic bailouts) are
 * rethrown untouched so the framework can handle them.
 */
export function handleRoute<C>(
  handler: (req: NextRequest, ctx: C) => Promise<Response>
): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      unstable_rethrow(error)
      if (error instanceof ApiError) {
        return jsonError(error.status, error.code, error.message, error.headers)
      }
      if (error instanceof z.core.$ZodError) {
        const apiError = validationError(error)
        return jsonError(apiError.status, apiError.code, apiError.message)
      }
      const id = createRequestId()
      console.error('[api]', id, error)
      return jsonError(500, 'internal_error', `Something went wrong. Reference: ${id}`, {
        'x-request-id': id,
      })
    }
  }
}

/**
 * Reads a request body as UTF-8 text, refusing anything over maxBytes. The
 * Content-Length header is checked first (cheap rejection), then bytes are
 * counted while streaming because the header can be absent or wrong.
 */
export async function readBodyText(req: Request, maxBytes: number): Promise<string> {
  const tooLarge = () =>
    new ApiError(413, 'payload_too_large', `Request body is larger than ${maxBytes} bytes.`)

  const declared = req.headers.get('content-length')
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    throw tooLarge()
  }
  if (!req.body) return ''

  const reader = req.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw tooLarge()
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
  opts?: { maxBytes?: number }
): Promise<T> {
  const text = await readBodyText(req, opts?.maxBytes ?? DEFAULT_MAX_JSON_BYTES)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const result = schema.safeParse(data)
  if (!result.success) throw validationError(result.error)
  return result.data
}

/** Query string → object (repeated keys become arrays), then validated. */
export function parseSearchParams<T>(url: URL | string, schema: z.ZodType<T>): T {
  const parsed = typeof url === 'string' ? new URL(url, 'http://localhost') : url
  const input: Record<string, string | string[]> = {}
  for (const key of new Set(parsed.searchParams.keys())) {
    const values = parsed.searchParams.getAll(key)
    input[key] = values.length > 1 ? values : values[0]
  }
  const result = schema.safeParse(input)
  if (!result.success) throw validationError(result.error)
  return result.data
}

// Postgres accepts any 8-4-4-4-12 hex string as a uuid, so the check matches
// the database rather than one RFC version (ids from seeds or imports pass).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const zUuid: z.ZodString = z.string().regex(UUID_REGEX, 'Must be a valid id')

export const zE164: z.ZodString = z
  .string()
  .regex(E164_REGEX, 'Must be a phone number in international format, e.g. +40712345678')

/** Marks a response as never cacheable (per-user or secret-bearing data). */
export function noStore(res: Response): Response {
  try {
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch {
    // Headers of redirect or fetched responses are immutable: copy instead.
    const headers = new Headers(res.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
}
