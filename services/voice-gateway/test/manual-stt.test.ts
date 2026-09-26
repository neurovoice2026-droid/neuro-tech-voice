import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TwilioClient } from './helpers/clients'
import { makeSessionConfig, startHarness, type Harness } from './helpers/harness'
import { textResponse } from './helpers/mock-openai'
import { mulawTone, waitFor } from './helpers/net'

// Romanian: ink-whisper on the manual endpoint, gateway VAD decides the turn.

let h: Harness
let twilio: TwilioClient | null = null

beforeEach(async () => {
  h = await startHarness()
})

afterEach(async () => {
  twilio?.dispose()
  twilio = null
  await h.close()
})

describe('manual STT (ink-whisper, Romanian)', () => {
  it('finalizes after the caller stops speaking and sends the Romanian text to the model', async () => {
    h.app.sessionConfig = () =>
      makeSessionConfig({
        language: 'ro',
        initial_message: null,
        voice: { ...makeSessionConfig().voice, voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c', language: 'ro' },
        stt: { model: 'ink-whisper', endpoint: 'manual', language: 'ro', keyterms: [], turn: null, manual: { min_volume: 0.15, max_silence_duration_secs: 0.8 } },
      })
    h.cartesia.manualFinalizeText = ' Bună ziua, aș dori o programare.'
    h.openai.queue.push(textResponse('Sigur, pentru ce zi doriți programarea?'))

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await waitFor(() => h.cartesia.sttConnections.find((c) => c.url.pathname === '/stt/websocket'), 3_000, 'manual stt')
    expect(Object.fromEntries(stt.url.searchParams)).toMatchObject({
      model: 'ink-whisper',
      language: 'ro',
      encoding: 'pcm_mulaw',
      sample_rate: '8000',
      min_volume: '0.15',
      max_silence_duration_secs: '0.8',
      cartesia_version: '2026-08-14',
    })
    expect(stt.url.searchParams.has('keyterm')).toBe(false)

    // 900 ms of speech, then silence: VAD speech end → text `finalize`.
    await twilio.sendAudio(mulawTone(900))
    expect(stt.texts).not.toContain('finalize')
    await twilio.sendAudio(Buffer.alloc(8000 * 1.1, 0xff))
    await waitFor(() => stt.texts.includes('finalize'), 3_000, 'finalize sent')

    await waitFor(() => h.openai.requests[0], 3_000, 'llm request')
    const input = h.openai.requests[0].body.input as Record<string, unknown>[]
    expect(input.at(-1)).toEqual({ role: 'user', content: 'Bună ziua, aș dori o programare.' })
    await waitFor(() => h.cartesia.spokenText().includes('Sigur, pentru ce zi doriți programarea?'), 3_000, 'reply spoken')
    const tts = h.cartesia.ttsMessages.find((m) => typeof m.transcript === 'string' && m.transcript.startsWith('Sigur'))!
    expect(tts.language).toBe('ro')
    expect(tts.voice).toBe('34acfaee-c556-41ee-a5f6-c687fb20357c')

    // Continuous 100 ms frames of μ-law.
    expect(stt.frames.length).toBeGreaterThan(10)
    expect(stt.frames.every((f) => f.length === 800)).toBe(true)

    twilio.stop()
    await waitFor(() => stt.texts.includes('close'), 3_000, 'close sent')
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.usage.stt_model).toBe('ink-whisper')
    expect(finalize.transcript.find((t) => t.role === 'user')?.message).toBe('Bună ziua, aș dori o programare.')
  })
})
