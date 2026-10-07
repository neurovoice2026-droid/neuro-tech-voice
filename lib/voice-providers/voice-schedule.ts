// Cadence of the slow voice maintenance steps. The voice-maintenance cron
// fires every 5 minutes (vercel.json); these windows select one run per
// period, like the hourly `retention` step in maintenance.ts. A missed run
// only delays the work to the next window: every step is idempotent.

const CRON_INTERVAL_MINUTES = 5

/** The first run of every hour. */
export function inHourlyWindow(now: Date = new Date()): boolean {
  return now.getUTCMinutes() < CRON_INTERVAL_MINUTES
}

/** The first run of every quarter hour. */
export function inQuarterHourWindow(now: Date = new Date()): boolean {
  return now.getUTCMinutes() % 15 < CRON_INTERVAL_MINUTES
}

/** The first run of the given UTC hour, once a day. */
export function inDailyWindow(hourUtc: number, now: Date = new Date()): boolean {
  return now.getUTCHours() === hourUtc && now.getUTCMinutes() < CRON_INTERVAL_MINUTES
}
