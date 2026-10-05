# Neuro Tech Voice

Multi-tenant SaaS for AI phone agents: businesses create an agent (prompt,
language, voice, knowledge base, working hours, human transfer), connect a phone
number and get call history with transcripts, recordings and analysis.

Stack: Next.js 16 (App Router, `proxy.ts`), TypeScript, Supabase (Postgres + RLS +
Storage), Twilio (numbers, call ingress), ElevenLabs Agents (primary voice
provider), Cartesia Managed Agents (fallback voice provider), Stripe, Resend,
SmartBill.

> This repo uses Next.js 16 — APIs and conventions differ from older versions.
> Read the guides in `node_modules/next/dist/docs/` before changing framework code
> (see `AGENTS.md`).

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in the values (never commit them)
npm run dev                    # http://localhost:3000
```

Database: apply the SQL files in `supabase/migrations/` in order (001 → 010) with
the Supabase CLI or the SQL editor, and create the private Storage bucket from
`supabase/STORAGE_BUCKET.sql`. Migration `010_voice_providers.sql` is idempotent
and additive (safe to re-run); it briefly locks the main tables, so apply it at
low traffic (see docs/voice-providers.md §6).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + integration tests (mocked providers, no network, no calls) |
| `node scripts/reconcile-voice-providers.mjs --base-url <url>` | Dry-run reconciliation of agents with ElevenLabs/Cartesia (`--apply` to fix) |
| `node scripts/live-smoke-test.mjs --base-url <url>` | Read-only live diagnostics; places a real call only with `--confirm-live` + typed confirmation |

Both scripts call the deployment's admin API and need `ADMIN_API_TOKEN` in the environment.

## Voice providers

ElevenLabs answers calls by default; when it is unavailable, new calls on
smart-routed numbers are answered by a Cartesia agent built from the same
configuration. Working hours are enforced before any provider is used.

* Architecture, capability matrix, configuration (ElevenLabs, Cartesia, Twilio,
  Vercel), webhooks, schema, security/retention and the incident runbook:
  [`docs/voice-providers.md`](docs/voice-providers.md)
* Automated, manual and live test procedure:
  [`docs/voice-provider-test-plan.md`](docs/voice-provider-test-plan.md)

## Deployment (Vercel)

* Set every variable from `.env.example` (Production and Preview separately).
* `VOICE_PUBLIC_BASE_URL` must be the stable public origin: Twilio request
  signatures are validated against it.
* `vercel.json` schedules `/api/cron/voice-maintenance` every 5 minutes
  (protected by `CRON_SECRET`).
* After deploying, check `GET /api/admin/voice/diagnostics?probe=1` with the admin
  token: it lists missing configuration by name (values are never returned).
