import { AppClient } from '../../src/app-client'
import { DEFAULT_TIMINGS, type GatewayConfig, type GatewayTimings } from '../../src/config'
import type { VoicePipelineMode, VoiceSessionConfig, VoiceToolDefinition } from '../../src/contracts'
import { createLogger, silentLogger } from '../../src/log'
import { createGatewayServer, type GatewayServer } from '../../src/server'
import { signSessionToken } from '../../src/signing'
import { startMockApp, type MockApp } from './mock-app'
import { startMockCartesia, type MockCartesia } from './mock-cartesia'
import { startMockElevenLabs, type MockElevenLabs } from './mock-elevenlabs'
import { startMockOpenAI, type MockOpenAI } from './mock-openai'

// Boots every mock plus a real gateway server on random ports. Nothing leaves
// the machine: provider base URLs point at the mocks.

export const CALL_ID = '7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f'
export const ORG_ID = '0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b'
export const AGENT_ID = '11111111-2222-4333-8444-555555555555'
export const SECRET = 'gateway-test-secret-0123456789abcdef-0123456789'

export const CHECK_AVAILABILITY: VoiceToolDefinition = {
  name: 'check_availability',
  description: 'List free appointment slots.',
  parameters: {
    type: 'object',
    properties: {
      date_from: { type: 'string' },
      date_to: { type: ['string', 'null'] },
      service: { type: ['string', 'null'] },
      time_of_day: { type: 'string', enum: ['any', 'morning', 'afternoon', 'evening'] },
    },
    required: ['date_from', 'date_to', 'service', 'time_of_day'],
    additionalProperties: false,
  },
  pre_tool_speech: true,
  side_effects: false,
}

export const END_CALL: VoiceToolDefinition = {
  name: 'end_call',
  description: 'End the call after saying goodbye.',
  parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'], additionalProperties: false },
  pre_tool_speech: false,
  side_effects: false,
}

export function makeSessionConfig(overrides: Partial<VoiceSessionConfig> = {}): VoiceSessionConfig {
  const base: VoiceSessionConfig = {
    session_id: CALL_ID,
    call_id: CALL_ID,
    org_id: ORG_ID,
    agent_id: AGENT_ID,
    mode: 'cartesia_self',
    channel: 'twilio',
    direction: 'inbound',
    is_test: false,
    from_number: '+40712345678',
    to_number: '+40312345678',
    twilio_call_sid: 'CAtest',
    language: 'en',
    timezone: 'Europe/Bucharest',
    agent_name: 'Ana',
    business_name: 'Acme Dental',
    instructions: 'You are Ana, the AI receptionist for Acme Dental.',
    call_context: 'Current local time: Thursday 17 September 2026, 10:00 (Europe/Bucharest). Caller: +40712345678.',
    initial_message: 'Hello, thanks for calling Acme Dental.',
    fallback_message: "Sorry, I didn't catch that.",
    apology_message: "Sorry, we're having technical trouble. Please call again shortly.",
    voice: {
      voice_id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
      tts_model: 'sonic-3.6-2026-08-27',
      language: 'en',
      speed: null,
      volume: null,
      emotion: null,
      pronunciation_dict_id: null,
    },
    stt: {
      model: 'ink-2',
      endpoint: 'turns',
      language: 'en',
      keyterms: ['Acme Dental'],
      turn: { start_threshold: 0.8, eager_end_threshold: 0.4, end_threshold: 0.2, end_timeout_ms: 5600 },
      manual: null,
    },
    llm: { model: 'gpt-5.6-luna', max_output_tokens: 400, reasoning_effort: 'none', max_tool_hops: 4 },
    tools: [CHECK_AVAILABILITY, END_CALL],
    behavior: { allow_interruptions: true, silence_timeout_seconds: null, max_duration_seconds: 600, record: false, voicemail_detection: false },
    cartesia_agent_id: null,
    elevenlabs: {
      agent_id: 'el_agent_test',
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      prompt: 'You are Ana for Acme Dental. Greet {{caller_name}} politely.',
      first_message: 'Hello, thanks for calling Acme Dental.',
      language: 'en',
    },
    safety_identifier: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  }
  return { ...base, ...overrides }
}

export interface Harness {
  app: MockApp
  cartesia: MockCartesia
  openai: MockOpenAI
  elevenlabs: MockElevenLabs
  gateway: GatewayServer
  config: GatewayConfig
  url: string
  token(options?: { ch?: 'twilio' | 'browser'; mode?: VoicePipelineMode; sid?: string; expInSeconds?: number }): string
  close(): Promise<void>
}

export async function startHarness(options: { providers?: { cartesia?: boolean; openai?: boolean; elevenlabs?: boolean }; timings?: Partial<GatewayTimings> } = {}): Promise<Harness> {
  const [app, cartesia, openai, elevenlabs] = await Promise.all([startMockApp(SECRET), startMockCartesia(), startMockOpenAI(), startMockElevenLabs()])
  const providers = { cartesia: true, openai: true, elevenlabs: true, ...options.providers }
  const config: GatewayConfig = {
    port: 0,
    host: '127.0.0.1',
    appUrl: app.server.baseUrl,
    gatewaySecret: SECRET,
    logLevel: 'debug',
    maxConcurrentCalls: 20,
    browserAllowedOrigins: [],
    healthDetailsToken: null,
    cartesia: { apiKey: providers.cartesia ? 'sk_car_test' : null, ttsModel: 'sonic-3.6-2026-08-27', apiBase: cartesia.server.baseUrl, version: '2026-08-14' },
    openai: { apiKey: providers.openai ? 'sk-test-openai' : null, model: 'gpt-5.6-luna', baseUrl: openai.baseUrl },
    elevenlabs: { apiKey: providers.elevenlabs ? 'xi-test-key' : null, apiBase: elevenlabs.server.baseUrl, ttsModel: 'eleven_flash_v2_5' },
    timings: {
      ...DEFAULT_TIMINGS,
      twilioStartTimeoutMs: 2_000,
      componentConnectTimeoutMs: 1_500,
      agentConnectTimeoutMs: 1_500,
      managedReadyTimeoutMs: 2_000,
      silenceFillAfterMs: 200,
      hangupGraceMs: 300,
      shutdownDrainMs: 1_000,
      ...options.timings,
    },
  }
  const log = process.env.GATEWAY_TEST_LOGS ? createLogger('debug') : silentLogger
  const appClient = new AppClient({ appUrl: config.appUrl, secret: SECRET, log, finalizeBackoffMs: [30, 60] })
  const gateway = createGatewayServer({ config, log, app: appClient })
  const port = await gateway.listen(0, '127.0.0.1')
  return {
    app,
    cartesia,
    openai,
    elevenlabs,
    gateway,
    config,
    url: `ws://127.0.0.1:${port}`,
    token: ({ ch = 'twilio', mode = 'cartesia_self', sid = CALL_ID, expInSeconds = 120 } = {}) =>
      signSessionToken({ v: 1, sid, org: ORG_ID, agt: AGENT_ID, ch, mode, exp: Math.floor(Date.now() / 1000) + expInSeconds }, SECRET),
    async close() {
      await gateway.shutdown().catch(() => {})
      await Promise.allSettled([app.close(), cartesia.close(), openai.close(), elevenlabs.close()])
    },
  }
}
