// Free text written by the model that we store or write into the business's
// calendar: one line, long digit runs (phone or card numbers) masked, capped.
// Same rule as the transfer reason (app/api/telephony/tools/_lib). Pure.

export function sanitizeToolText(raw: string, max = 200): string {
  return raw
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\+?\d[\d\s().-]{4,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
