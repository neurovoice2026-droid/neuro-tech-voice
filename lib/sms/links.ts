// Links in texts the voice agent sends. The recipient is whatever number the
// call came from, and caller id can be spoofed: someone could call with a
// victim's number and talk the agent into texting them a phishing link from
// the business's real number. So a text from the agent may only link to the
// business's own website. Pure; used by the send_sms tool.

const BARE_DOMAIN_TLDS =
  'com|net|org|info|biz|io|co|ai|app|dev|me|ly|link|click|live|online|site|shop|store|top|xyz|eu|uk|ro|de|fr|it|es|nl|be|ch|at|pl|pt|se|no|dk|fi|cz|sk|hu|gr|ie|us|ca|au|nz|ru|cn|in|br|za|jp|sg'

const LINK_PATTERN = new RegExp(
  String.raw`(?:https?:\/\/[^\s<>"']+)|(?:www\.[^\s<>"']+)|(?:\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${BARE_DOMAIN_TLDS})\b(?:\/[^\s<>"']*)?)`,
  'gi'
)

function hostOf(link: string): string | null {
  const withScheme = /^https?:\/\//i.test(link) ? link : `https://${link}`
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  } catch {
    return null
  }
}

/** Links (or bare domains) in `message` that don't point at `website` or one of its subdomains. */
export function linksOutsideWebsite(message: string, website: string | null | undefined): string[] {
  const allowed = website ? hostOf(website.trim()) : null
  const found = message.match(LINK_PATTERN) ?? []
  return found.filter((link) => {
    const host = hostOf(link.replace(/[.,;:!?)]+$/, ''))
    if (!host || !allowed) return true
    return host !== allowed && !host.endsWith(`.${allowed}`)
  })
}
