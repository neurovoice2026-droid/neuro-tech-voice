// Agent > Availability (components/agent/tabs/TabAvailability.tsx) is
// server-rendered when /agent?tab=availability is opened directly. The server
// runs in UTC (Vercel) and the owner's browser in their own zone, so the
// server HTML must not depend on either: no "Use <browser zone>" button and no
// clock reading until the browser has hydrated. These tests render the tab as
// the server does, under different process zones and minutes, and hold the
// HTML to be the same each time.

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TabAvailability } from '@/components/agent/tabs/TabAvailability'
import type { Agent } from '@/types'

const AGENT: Agent = {
  id: 'a1',
  org_id: 'org1',
  elevenlabs_agent_id: null,
  name: 'Maria',
  voice_id: null,
  voice_name: null,
  language: 'en',
  system_prompt: null,
  first_message: null,
  is_active: true,
  working_hours: {},
  fallback_message: null,
  metadata: {},
  after_hours: { enabled: true, mode: 'message' },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

/** The tab as the server renders it, with the process (server) zone forced to `zone`. */
function serverHtml(zone: string): string {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions
  const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...resolved.call(this), timeZone: zone }
  })
  try {
    return renderToString(
      createElement(TabAvailability, {
        agent: AGENT,
        timezone: 'Europe/Bucharest',
        timezoneUnavailable: false,
        onUpdate: vi.fn(async () => null),
        onTimezoneSaved: vi.fn(),
        isSaving: false,
      }),
    )
  } finally {
    spy.mockRestore()
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Availability tab server HTML', () => {
  it('is the same whatever the server zone, and offers no "Use <zone>" button before hydration', () => {
    const utc = serverHtml('UTC')
    const newYork = serverHtml('America/New_York')
    expect(newYork).toBe(utc)
    expect(utc).not.toMatch(/Use (UTC|America\/New_York)/)
  })

  it('shows a stable line instead of the local time, so a minute boundary cannot change it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T09:59:59.900Z'))
    const before = serverHtml('UTC')
    vi.setSystemTime(new Date('2026-10-15T10:00:00.100Z'))
    const after = serverHtml('UTC')
    expect(after).toBe(before)
    expect(before).toContain('Checking the local time…')
    expect(before).not.toContain('local time 1')
    // The zone's offset ("UTC+03:00") is also time-dependent: only the zone name is in the HTML.
    expect(before).not.toContain('UTC+0')
  })
})
