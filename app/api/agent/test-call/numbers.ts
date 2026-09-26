// How many different numbers one organisation's phone test calls may ring in a day.
// Pure, so the rule is testable without the route.

/** Different numbers one organisation's phone test calls may ring per UTC day (an owner and a colleague or two). */
export const TEST_CALL_NUMBERS_PER_DAY = 3

/**
 * The day's list of numbers (hashed) with `to` added, or null when `to` is new
 * and the list is already full.
 */
export function nextTestCallNumbers(known: readonly string[], toHash: string, max = TEST_CALL_NUMBERS_PER_DAY): string[] | null {
  if (known.includes(toHash)) return [...known]
  if (known.length >= max) return null
  return [...known, toHash]
}
