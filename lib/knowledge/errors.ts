/**
 * A document couldn't be read or processed for a reason the owner can act on.
 * The message is shown in the dashboard as-is, so it must be plain, specific
 * and free of provider details.
 */
export class KnowledgeIngestError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'KnowledgeIngestError'
    this.code = code
  }
}

export function isKnowledgeIngestError(error: unknown): error is KnowledgeIngestError {
  return error instanceof KnowledgeIngestError
}
