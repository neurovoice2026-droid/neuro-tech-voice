// The reason an operator writes to lift a do-not-call flag, with the same
// bounds as DELETE /api/commerce/suppressions/[customerId] (reason: trimmed,
// 3–200 characters); the test in tests/commerce/suppression-reason proves the
// two sides agree. Pure and client-safe.

export const SUPPRESSION_REASON_MIN = 3
export const SUPPRESSION_REASON_MAX = 200

/** Whether the dialog may send this reason (trimmed length within the route's bounds). */
export function suppressionReasonOk(reason: string): boolean {
  const length = reason.trim().length
  return length >= SUPPRESSION_REASON_MIN && length <= SUPPRESSION_REASON_MAX
}
