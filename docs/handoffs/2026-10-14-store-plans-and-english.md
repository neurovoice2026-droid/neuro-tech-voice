# Session handoff: e-commerce vertical, store plans, English copy

Written 2026-10-14 so that a fresh session (any model, any container) can
continue without the previous conversation. Read this whole file first, then
`docs/commerce-integrations.md`. Replies to the owner are written in Romanian;
code, docs and merchant-facing UI are English.

## Standing instructions from the owner

- Work autonomously. Do not ask for approvals or choices: make safe defaults,
  document them, finish the whole task, report truthfully.
- Commit and push directly to `main` (production deploys from `main`); mirror
  the same commit to `claude/amazing-shannon-ognheq`. No pull requests.
- Use multi-agent workflows ("ultracode") for substantive work: parallel
  implementers on disjoint file sets, a validator (tsc, eslint, full vitest,
  build), adversarial reviewers, fixers, final validation. Then run the four
  checks yourself before committing.
- Never create real voice agents, buy numbers or place live calls without an
  explicit order. Never print, store or paste secrets; list Vercel envs with
  `decrypt=false` only. Mask phone numbers in logs. No empty `catch {}`.
- End every commit message with the attribution trailers the harness provides
  (`Co-Authored-By` and `Claude-Session`). No model identifiers anywhere in
  repository artifacts.
- The owner's chat language is Romanian.

## Infrastructure (ids, no secrets)

- Vercel project `prj_rFuvMMVV940S8XQ0X6c45b0krCig`, team
  `team_RDYSCmOCjh5Ddw2gCl5Ue8MO`, production `www.neurotechvoice.com`
  (Hobby plan: runtime logs are retained for one hour only). Use the Vercel
  MCP tools (`list_deployments`, `get_deployment`, `get_runtime_logs`,
  `filter_project_envs` with decrypt=false, `create_project_env`,
  `create_deployment` with `gitSource`).
- Supabase project `acqqacynjzzwwackjizu` (MCP: `apply_migration`,
  `execute_sql`, `get_advisors`, `list_migrations`). Migrations 001 through
  025 are applied. pg_cron job `ntv-voice-maintenance` calls
  `/api/cron/voice-maintenance` every 5 minutes with `CRON_SECRET`.
- Vercel env already set: `COMMERCE_CREDENTIALS_ENCRYPTION_KEY` (sensitive,
  production + preview). Not set, by design until the owner has them:
  `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` (needs the owner's Shopify
  Partners app; the Shopify card says "not configured" until then) and the
  optional `STRIPE_STORE_*_PRICE_ID` ids (store plans auto-provision their
  Stripe prices by `lookup_key`, see below).
- GitHub push protection rejects pushes containing secret-shaped strings:
  test fixtures must not look like real tokens (`shpat_` + 32 hex, `key-` +
  32 alphanumerics, ...).

## Delivered on `main` (verified in production)

- `92020f9` feat(commerce): the e-commerce vertical. Step 0 business type
  (one-time, server-side; legacy organizations are `services` and skip it),
  6-step store onboarding, store dashboard section, migration 024 (strict
  RLS, column guards, service-only queues with `FOR UPDATE SKIP LOCKED`),
  AES-256-GCM credential envelope, SSRF-guarded store fetches, adapters
  (WooCommerce, Shopify OAuth, Magento OAuth 1.0a/bearer, PrestaShop, custom
  signed JSON contract), durable sync/webhook/dispatch queues inside the
  5-minute maintenance cron, automations (COD confirmation, abandoned cart,
  order follow-up) with eligibility rules and single-dial guarantees, six
  store tools for the ElevenLabs and Cartesia agents, Romanian agent prompt.
- `1e62bd5` chore(commerce): migration 025, covering indexes for the commerce
  foreign keys.
- Verification at that point: 220 Vitest files / 2384 tests, eslint 0 errors
  (122 pre-existing warnings), tsc clean, `npm run build` clean, deploy READY,
  cron tick clean, six ElevenLabs platform tools created, 0 existing agents
  changed.
- Known, intentional limits (documented in `docs/commerce-integrations.md`):
  custom-connector HMAC covers the body only; Shopify expiring tokens are not
  refreshed (offline token in use); Shopify `customer_phone` stays
  "to be confirmed" for an empty shop; PrestaShop address-only phone edits
  reach the customer mirror on the next full sync; WooCommerce's unsigned
  creation ping is accepted only as an "ignored" event.

## In progress: store pricing plans + English e-commerce copy

Owner's request (2026-10-14): pricing plans dedicated to online stores,
selectable on the pricing section, starting at $100/month, balanced and
profitable for both sides; everything in English, including what a new
sign-up sees (Step 0 and the store onboarding were Romanian).

Design decisions already taken (do not re-open):

| id | name | monthly | annual | minutes | overage | family |
|---|---|---|---|---|---|---|
| store_starter | Store Starter | $100 | $1,000 | 350 | $0.25 | ecommerce |
| store_growth | Store Growth | $250 | $2,500 | 950 | $0.22 | ecommerce |
| store_scale | Store Scale | $500 | $5,000 | 2,000 | $0.20 | ecommerce |
| store_enterprise | Store Enterprise | $1,000 | $10,000 | 4,500 | $0.18 | ecommerce, contact sales |

- Blended COGS ~ $0.10/min, so every tier keeps >= 60% gross margin at full
  usage; annual = 10 x monthly (two months free), like the service plans.
- `types/index.ts`: `Plan` gains the four ids; `PlanConfig.family`
  (`'services' | 'ecommerce' | 'any'`, trial = any); `SERVICE_PLANS`,
  `STORE_PLANS`, `plansForBusinessType()`, `planAllowedFor()`. Rule: an
  ecommerce organization holds trial or a store plan; a services or legacy
  organization holds trial or a service plan; enforced in
  `/api/billing/checkout` and `/api/onboarding/complete` (409
  `plan_not_available`), and the UI shows only the matching family.
- Stripe without manual setup: `lib/stripe/store-prices.ts`
  `ensurePlanPriceId(plan, interval)` uses the env id when set, else finds or
  creates the price by `lookup_key` `ntv_<plan>_<interval>` with metadata
  `ntv_plan`; the billing webhook resolves a subscription's plan by price map,
  then subscription metadata `ntv_plan`, then `resolvePlanFromPrice`.
- Migration `supabase/migrations/026_store_plans.sql` widens
  `organizations_plan_check`. It must be applied to Supabase BEFORE the code
  that writes store plans is deployed (the webhook writes `store_*`).
- Routes renamed `/magazin/*` -> `/store/*` (orders, customers, products,
  automations, connections, do-not-call, settings); nav label "Store"; proxy
  protected paths and the Shopify OAuth return path follow.
- Pricing section (`components/site/home/pricing.tsx`, data in `lib/site.ts`)
  gets an audience selector "Service businesses | Online stores"; store CTAs
  link to `/register?intent=store`; the register page stores the cookie
  `ntv_business_intent=ecommerce`; Step 0 pre-selects "Online store" (the
  owner still confirms; the one-time server-side choice is unchanged).
- English everywhere merchant-facing (UI, API errors, adapter notes, consent
  text with `CONSENT_VERSION` bumped to `2026-10-v2`, platform catalog).
  Agent-facing text stays in the call language (Romanian by default):
  `buildCommerceAgentPrompt`, `DEFAULT_SCRIPTS`, tool-result sentences in
  `lib/commerce/tools/handlers.ts`, `lib/voice-providers/prompt-commerce.ts`.
- Entitlements: store plans mirror the service plan with the nearest price
  (Store Starter = Starter-level entitlements; recordings from Store Growth).

Execution state at the time of writing: workflow run `wf_a8eb3f28-018`
(script `~/.claude/projects/-home-user-neuro-tech-voice/<session>/workflows/scripts/store-plans-and-english-wf_a8eb3f28-018.js`,
journal `.../subagents/workflows/wf_a8eb3f28-018/journal.jsonl`). The six
implementers (plans-backend, pricing-marketing, l10n-onboarding,
l10n-dashboard, l10n-core, l10n-adapters) finished; the first validator
(tsc, eslint, vitest, build) was running; still to run: three adversarial
reviews (billing, english, routes), fixers, final validator. If that run is
still resumable, continue it with
`Workflow({ scriptPath, resumeFromRunId: 'wf_a8eb3f28-018' })` (finished
agents replay from cache). If the container is new, the working tree
snapshot lives in the commit `wip(commerce): store plans and English copy`
on `claude/amazing-shannon-ognheq`: check it out, run the four checks, then
launch a fresh review workflow over the same scope (billing correctness,
English completeness with a diacritics grep over merchant-facing areas,
`/magazin` leftovers, Step 0 intent chain) and fix what it confirms.

## Remaining steps for this task (in order)

1. Read the workflow result or re-run validation: `npx tsc --noEmit`,
   `npx eslint .` (0 errors), `npx vitest run`, `npm run build`.
2. Review the money path by hand: `app/api/billing/checkout/route.ts`,
   `app/api/billing/webhook/route.ts`, `app/api/onboarding/complete/route.ts`,
   `lib/stripe/store-prices.ts`, `lib/stripe/client.ts`.
3. Apply `supabase/migrations/026_store_plans.sql` with the Supabase MCP
   (`apply_migration`, name `026_store_plans`), then confirm with
   `execute_sql` that the CHECK lists all nine plan ids.
4. Squash the WIP snapshot into one commit on top of `1e62bd5`
   (`git reset --soft 1e62bd5`, then commit with a descriptive message and
   the trailers), push to `main` and to `claude/amazing-shannon-ognheq`
   (`git push origin HEAD:main` and `HEAD:claude/amazing-shannon-ognheq`;
   if the branch has the WIP commit, `--force-with-lease` is fine on that
   branch only, never on `main`).
5. Verify: deployment READY (Vercel MCP), `/store` redirects to login when
   signed out, `/` renders the pricing selector, runtime logs show a clean
   cron tick, Supabase advisors show nothing new.
6. Hand off to the owner in Romanian: the plan table above, where the
   selector lives, what changed in the sign-up flow, that Stripe prices are
   created automatically at the first checkout (and that
   `STRIPE_STORE_*_PRICE_ID` can pin them later), remaining manual items.

## Manual items that only the owner can do

- Register the Shopify app (non-embedded, redirect URI
  `https://www.neurotechvoice.com/api/commerce/oauth/shopify/callback`,
  scopes `read_orders,read_customers,read_products,read_checkouts`,
  protected customer data approval), then provide `SHOPIFY_CLIENT_ID` and
  `SHOPIFY_CLIENT_SECRET` to be set in Vercel.
- A live call test needs a connected store and a cash-on-delivery order on
  the owner's own number (plan in `docs/commerce-integrations.md` section 10).
- Optional hygiene outside this task: seven pre-existing unindexed foreign
  keys on non-commerce tables (Supabase performance advisor, INFO level);
  Supabase Auth "leaked password protection" is disabled (dashboard setting).
- Follow-up noted by the plans implementer: `app/api/voices/{clone,design,
  limits}` show the service-plan hint ("Pro plan and above") to store
  organizations on the trial; passing the business type there is a small
  change.
