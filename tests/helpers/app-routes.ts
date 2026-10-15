// The app's page routes, read off the app/ directory the way Next maps it:
// route groups "(name)" add no segment, a "[param]" folder matches one
// segment. Lets a test ask whether a link leads to a page that exists
// without starting a server.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { INDUSTRY_SLUGS } from '@/lib/pages/industries'

const APP_DIR = join(process.cwd(), 'app')

function collect(dir: string, segments: string[], out: string[][]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'api' && segments.length === 0) continue
      const next = /^\(.+\)$/.test(entry.name) ? segments : [...segments, entry.name]
      collect(join(dir, entry.name), next, out)
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      out.push(segments)
    }
  }
}

/** Every page route as its segments, e.g. ['industries', '[slug]']. */
export function pageRoutes(): string[][] {
  const out: string[][] = []
  collect(APP_DIR, [], out)
  return out
}

/**
 * The values a dynamic route prerenders. A dynamic page not listed here
 * cannot be vouched for, so a link into it counts as unresolved.
 */
const KNOWN_PARAMS: Record<string, readonly string[]> = {
  'industries/[slug]': INDUSTRY_SLUGS,
}

/** True when `path` (no query, no hash) is a page the app serves. */
export function resolvesToPage(path: string, routes: string[][] = pageRoutes()): boolean {
  const parts = path.split('/').filter(Boolean)
  return routes.some((route) => {
    if (route.length !== parts.length) return false
    return route.every((segment, i) => {
      if (!/^\[.+\]$/.test(segment)) return segment === parts[i]
      const known = KNOWN_PARAMS[route.slice(0, i + 1).join('/')]
      return known !== undefined && known.includes(parts[i])
    })
  })
}
