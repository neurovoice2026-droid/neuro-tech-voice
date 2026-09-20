import 'server-only'
import { ApiError } from '@/lib/api/http'
import { quotaHeaders } from './quota'
import { formatResetDate, type ToolQuota } from './usage'

/** 45 → "under a minute", 125 → "about 3 minutes". */
export function describeDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) return 'under a minute'
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? 'about 1 minute' : `about ${minutes.toLocaleString('en-US')} minutes`
}

/** 429 with the quota headers, worded for the tool that ran out. */
export function quotaExceeded(quota: ToolQuota, detail?: string): ApiError {
  const resets = formatResetDate(quota.period)
  const what = quota.kind === 'tts_tool'
    ? `${quota.state.limit.toLocaleString('en-US')} characters of text to speech`
    : `${Math.round(quota.state.limit / 60).toLocaleString('en-US')} minutes of transcription`
  const lead = quota.state.remaining > 0 && detail ? detail : `You’ve used this period’s ${what}.`
  return new ApiError(
    429,
    'quota_exceeded',
    `${lead} Your allowance resets on ${resets}, or you can upgrade your plan for more.`,
    quotaHeaders(quota.state, quota.period)
  )
}

export function sttDoesNotFit(quota: ToolQuota, seconds: number): ApiError {
  const left = Math.floor(quota.state.remaining / 60)
  const leftText = left < 1 ? 'less than a minute' : left === 1 ? '1 minute' : `${left.toLocaleString('en-US')} minutes`
  return quotaExceeded(quota, `This recording is ${describeDuration(seconds)} long and you have ${leftText} of transcription left.`)
}
