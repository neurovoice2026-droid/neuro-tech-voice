// Small fetch helpers for the Phone Numbers page: every API error arrives as
// { error: { code, message } } and the message is already written for owners.

export class PhoneApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'PhoneApiError'
    this.status = status
    this.code = code
  }
}

const NETWORK_MESSAGE = 'We couldn’t reach the server. Check your connection and try again.'

export async function phoneApi<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
      cache: 'no-store',
    })
  } catch {
    throw new PhoneApiError(0, 'network_error', NETWORK_MESSAGE)
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // Empty or non-JSON body; handled below.
  }
  if (!res.ok) {
    const error = (data as { error?: { code?: unknown; message?: unknown } } | null)?.error
    const message = typeof error?.message === 'string' ? error.message : 'Something went wrong. Please try again.'
    const code = typeof error?.code === 'string' ? error.code : 'unknown_error'
    throw new PhoneApiError(res.status, code, message)
  }
  return data as T
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.'
}
