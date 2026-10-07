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

Database: apply the SQL files in `supabase/migrations/` in order (001 → 011) with
the Supabase CLI or the SQL editor, and create the private Storage bucket from
`supabase/STORAGE_BUCKET.sql`. Migrations `010` and `011` are idempotent and
additive (safe to re-run); `010` briefly locks the main tables, so apply it at
low traffic, and apply `011` after deploying the app version that ships it
(see docs/voice-providers.md §6). On the Vercel Hobby plan, schedule the
5-minute maintenance from Supabase with `supabase/ops/schedule_voice_maintenance.sql`.

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
* `vercel.json` schedules `/api/cron/voice-maintenance` once a day (protected by
  `CRON_SECRET`): the Hobby plan rejects deployments with more frequent crons.
  On Pro, change the schedule to `*/5 * * * *`; on Hobby, an external scheduler
  can call it every 5 minutes instead (docs/voice-providers.md §Vercel).
* After deploying, check `GET /api/admin/voice/diagnostics?probe=1` with the admin
  token: it lists missing configuration by name (values are never returned).
