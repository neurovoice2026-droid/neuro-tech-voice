#!/usr/bin/env node
// Live smoke test for the voice stack of a deployed environment.
//
// Default (safe, read-only): admin diagnostics + live provider health probes.
//   ADMIN_API_TOKEN=... node scripts/live-smoke-test.mjs --base-url https://staging.example.com
//
// Places ONE real phone call only with an explicit flag and an interactive
// confirmation that repeats the destination number:
//   ... --confirm-live --org-id <uuid> --to +40712345678 [--phone-number-id <uuid>]
// The call costs money (Twilio + provider minutes) and rings a real phone: use
// a number you control. To exercise the Cartesia fallback, run it against a
// staging deployment with VOICE_FORCE_PROVIDER=cartesia (never in production).
// See docs/voice-provider-test-plan.md for the full manual checklist.

import readline from 'node:readline/promises'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null
}

const baseUrl = (value('base-url') ?? process.env.APP_BASE_URL ?? '').replace(/\/$/, '')
const token = process.env.ADMIN_API_TOKEN ?? ''
if (!baseUrl || !token) {
  console.error('Usage: ADMIN_API_TOKEN=... node scripts/live-smoke-test.mjs --base-url <url> [--confirm-live --org-id <uuid> --to <E.164>]')
  process.exit(2)
}
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

async function call(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(60_000) })
  const json = await res.json().catch((err) => ({ error: `invalid JSON response: ${err.message}` }))
  return { ok: res.ok, status: res.status, json }
}

console.log(`→ Diagnostics for ${baseUrl}`)
const diag = await call('/api/admin/voice/diagnostics?probe=1')
if (!diag.ok) {
  console.error(`Diagnostics failed (${diag.status}):`, diag.json.error ?? diag.json)
  process.exit(2)
}
const d = diag.json
const errors = d.problems.filter((p) => p.severity === 'error')
console.log(`  config problems: ${errors.length} error(s), ${d.problems.length - errors.length} warning(s)`)
for (const p of d.problems) console.log(`   - [${p.severity}] ${p.key}: ${p.message}`)
for (const h of d.health ?? []) console.log(`  ${h.provider}: configured=${h.configured} ok=${h.ok} latency=${h.latencyMs ?? '-'}ms ${h.errorCode ?? ''}`)
console.log(`  circuits: elevenlabs=${d.circuits.elevenlabs.state}/${d.circuits.elevenlabs_media.state} (api/media) cartesia=${d.circuits.cartesia.state}/${d.circuits.cartesia_media.state}`)
console.log(`  webhook backlog: ${JSON.stringify(d.webhook_backlog)}; failovers 24h: ${d.failovers_24h.total} (final ${d.failovers_24h.final_failures})`)

if (!flag('confirm-live')) {
  console.log('\nRead-only checks done. No call was placed (pass --confirm-live to place one).')
  process.exit(errors.length ? 1 : 0)
}

const orgId = value('org-id')
const to = value('to')
if (!orgId || !to || !/^\+[1-9]\d{6,14}$/.test(to)) {
  console.error('--confirm-live requires --org-id <uuid> and --to <E.164 number you control>.')
  process.exit(2)
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const typed = (await rl.question(`\nThis will place a REAL call to ${to}. Type "CALL ${to}" to continue: `)).trim()
rl.close()
if (typed !== `CALL ${to}`) {
  console.log('Confirmation did not match. Aborted; no call was placed.')
  process.exit(1)
}
const placed = await call('/api/admin/voice/test-call', {
  method: 'POST',
  body: JSON.stringify({ org_id: orgId, to_number: to, phone_number_id: value('phone-number-id') ?? undefined, confirm: typed }),
})
if (!placed.ok) {
  console.error(`Call not placed (${placed.status}):`, placed.json.error ?? placed.json)
  process.exit(1)
}
console.log(`Call queued: call_id=${placed.json.call_id} routing_mode=${placed.json.routing_mode}`)
console.log('Answer the phone, follow the checklist in docs/voice-provider-test-plan.md, then check the call in the dashboard (Calls → provider badge, transcript, recording).')
