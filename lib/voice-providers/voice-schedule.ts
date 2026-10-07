// Cadence of the slow voice maintenance steps. Each step claims its slot in
// maintenance_state (runIfDue, ./maintenance-state.ts: a compare-and-set on
// the step's last run) instead of reading the clock minute of the cron
// invocation, so it runs with ANY schedule: once a day with the Vercel Hobby
// cron (vercel.json, 03:17 UTC), every 5 minutes with pg_cron or Vercel Pro.
// A missed run only delays the work to the next invocation: every step is
// bounded and idempotent.

export const QUARTER_HOUR_MS = 15 * 60_000
export const HOUR_MS = 60 * 60_000
/**
 * "Once a day". 20 h rather than 24 h: Vercel runs a Hobby cron anywhere in
 * its scheduled hour, so a daily invocation can come a little less than 24 h
 * after the previous one; with a 24 h interval that run would not be due and
 * the step would skip a whole day.
 */
export const DAILY_MS = 20 * HOUR_MS

/** maintenance_state keys of the voice steps (one claim per period across instances). */
export const VOICE_STEP_KEYS = {
  orphanScan: 'voice_orphan_scan',
  designPreviews: 'voice_design_previews',
  ttsHistoryRetention: 'voice_tts_history_retention',
  defaultVoiceReport: 'default_voice_report',
  defaultVoiceMigration: 'default_voice_migrate',
} as const
