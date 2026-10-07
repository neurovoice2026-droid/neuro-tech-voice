import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startWebsiteImportInBackground } from '@/hooks/useKnowledgeWebsite'

// Onboarding starts the opt-in website import in the background; a refusal
// must come back to the launch screen (shown to the owner), not only to the
// console.

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('startWebsiteImportInBackground', () => {
  it('resolves ok when the import started', async () => {
    const fetchMock = vi.fn(async () => json(201, { id: 'w1' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(startWebsiteImportInBackground('https://acme.example')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/agent/knowledge/website', expect.objectContaining({ method: 'POST', keepalive: true }))
  })

  it("returns the server's reason for a refusal", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'This website is already imported. Remove it first to import it again.' })))
    await expect(startWebsiteImportInBackground('https://acme.example')).resolves.toEqual({
      ok: false,
      status: 409,
      message: 'This website is already imported. Remove it first to import it again.',
    })
  })

  it('has readable fallbacks for rate limits, outages and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 429 })))
    expect(await startWebsiteImportInBackground('https://acme.example')).toMatchObject({ ok: false, status: 429, message: expect.stringMatching(/try again later/i) })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    expect(await startWebsiteImportInBackground('https://acme.example')).toMatchObject({ ok: false, status: 503, message: expect.stringMatching(/unavailable/i) })

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await startWebsiteImportInBackground('https://acme.example')).toMatchObject({ ok: false, status: null, message: expect.stringMatching(/connection/i) })
  })
})
