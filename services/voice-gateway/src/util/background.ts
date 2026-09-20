import type { Logger } from '../log'

/**
 * Runs a promise nobody awaits (timers, socket callbacks) and logs its failure
 * with context instead of leaving an unhandled rejection behind.
 */
export function background(promise: Promise<unknown>, log: Logger, label: string): void {
  promise.catch((error: unknown) => {
    log.error(`${label} failed`, { error: error instanceof Error ? error : String(error) })
  })
}
