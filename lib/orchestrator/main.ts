// ─── Orchestrator entry point ────────────────────────────────────────────────
// Run with: npm run orchestrator
//
// This is a separate deployable from the Next.js app. It needs:
//   FISH_AUDIO_API_KEY, LLM_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   NEXT_PUBLIC_SUPABASE_URL, and PORT.
//
// It does NOT need the Telnyx API key — it only receives audio; every command
// issued back to Telnyx goes through the Next.js webhook route instead.

import { createMediaServer } from './server'

const port = Number(process.env.PORT ?? 8080)

const required = [
  'FISH_AUDIO_API_KEY',
  'LLM_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  // Fail at boot rather than on the first call — a process that starts
  // healthy and then drops every call is much harder to diagnose than one
  // that refuses to start.
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const wss = createMediaServer({ port })

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, closing media server`)
    // Existing calls keep their sockets; close() only stops new connections,
    // so a deploy does not cut off people mid-conversation.
    wss.close(() => process.exit(0))
  })
}
