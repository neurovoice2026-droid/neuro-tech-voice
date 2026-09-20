import type { ProviderName } from '../breaker'

export type ProviderComponent = 'stt' | 'tts' | 'llm' | 'agent'

/**
 * Every provider failure the engines react to. `status`/`code` follow the
 * provider's own vocabulary (HTTP status or WS status_code, error_code) so the
 * app's breakerFailureKind can classify the same fields.
 */
export class ProviderError extends Error {
  readonly provider: ProviderName
  readonly component: ProviderComponent
  readonly status: number | null
  readonly code: string | null
  /** The provider said the session can't continue (socket closed, fatal flag). */
  readonly fatal: boolean

  constructor(input: {
    provider: ProviderName
    component: ProviderComponent
    message: string
    status?: number | null
    code?: string | null
    fatal?: boolean
    cause?: unknown
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause })
    this.name = 'ProviderError'
    this.provider = input.provider
    this.component = input.component
    this.status = input.status ?? null
    this.code = input.code ?? null
    this.fatal = input.fatal ?? true
  }

  get isQuota(): boolean {
    const code = this.code?.toLowerCase() ?? ''
    if (code === 'quota_exceeded' || code === 'insufficient_credits' || code === 'credits_exhausted') return true
    if (this.provider === 'cartesia' && this.status === 402) return true
    return false
  }

  /** Short, log-safe description (no upstream bodies beyond the message we built). */
  toJSON(): Record<string, unknown> {
    return {
      provider: this.provider,
      component: this.component,
      status: this.status,
      code: this.code,
      fatal: this.fatal,
      message: this.message,
    }
  }
}

export function isProviderError(value: unknown): value is ProviderError {
  return value instanceof ProviderError
}

/** Quota wording in free-text error messages (agent WS errors carry no error_code for it). */
export function mentionsQuota(message: string | null | undefined): boolean {
  return !!message && /\b(quota|credits? (exhausted|exceeded|balance)|insufficient (credits|balance|funds)|out of credits|billing limit|usage limit)\b/i.test(message)
}
