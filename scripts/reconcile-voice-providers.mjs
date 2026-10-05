#!/usr/bin/env node
// Reconciles local agents with their ElevenLabs/Cartesia agents through the
// admin API (so it runs with the deployment's own configuration and secrets).
//
//   ADMIN_API_TOKEN=... node scripts/reconcile-voice-providers.mjs --base-url https://app.example.com
//       → dry run: prints missing/failed/duplicate/orphaned resources
//   ... --apply                    → re-syncs every agent with an issue
//   ... --apply --delete-orphans   → also deletes ElevenLabs agents tagged for
//                                    this environment whose local agent is gone
//   ... --limit 200 --json
//
// Exit code: 0 = no issues (or applied), 1 = issues found in dry run, 2 = error.

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const baseUrl = (value('base-url', process.env.APP_BASE_URL ?? '') || '').replace(/\/$/, '')
const token = process.env.ADMIN_API_TOKEN ?? ''
if (!baseUrl || !token) {
  console.error('Usage: ADMIN_API_TOKEN=... node scripts/reconcile-voice-providers.mjs --base-url <url> [--apply] [--delete-orphans] [--limit N] [--json]')
  process.exit(2)
}

const body = { apply: flag('apply'), delete_orphans: flag('delete-orphans'), limit: Number(value('limit', '500')) }
const res = await fetch(`${baseUrl}/api/admin/voice/reconcile`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(300_000),
})
const json = await res.json().catch((err) => ({ error: `invalid JSON response: ${err.message}` }))
if (!res.ok) {
  console.error(`Reconcile failed (${res.status}):`, json.error ?? json)
  process.exit(2)
}
if (flag('json')) {
  console.log(JSON.stringify(json, null, 2))
} else {
  console.log(`${json.dryRun ? 'DRY RUN' : 'APPLIED'} — agents checked: ${json.agentsChecked}`)
  for (const i of json.issues) console.log(`  [${i.provider}] agent ${i.agentId}: ${i.kind}${i.externalIds ? ` (${i.externalIds.join(', ')})` : ''}${i.action ? ` → ${i.action}` : ''}`)
  for (const o of json.orphans) console.log(`  [${o.provider}] orphan ${o.externalId} (local ${o.localAgentId ?? 'unknown'})${o.note ? ` ${o.note}` : ''}${o.deleted ? ' → deleted' : ''}`)
  for (const e of json.errors) console.log(`  [${e.provider}] error during ${e.step}: ${e.error}`)
  if (!json.issues.length && !json.orphans.length) console.log('  No issues found.')
}
process.exit(json.dryRun && (json.issues.length || json.orphans.length) ? 1 : 0)
