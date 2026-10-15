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
  026 are applied; 027 and 028 are NOT applied yet (remaining step 3 applies
  them, before the push). pg_cron job `ntv-voice-maintenance` calls
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
- `45e7f1c` feat(billing,commerce): store pricing plans and the English store
  experience (migration 026 applied; deploy READY).
- `2fcbfa4` fix(onboarding): the service onboarding's steps 1 and 2 now save
  on the server (`/api/onboarding/company`, `/api/onboarding/agent`) before
  advancing, and PUT /api/agent/voice creates the org's local agent row with
  `ensureAgent` when it is missing. Before this, step 3 answered "Agent not
  found. Finish setting up your agent first." for every voice. Deploy
  `dpl_H6RvDWYAEsBqJfR5o54zNJVXF1bt` READY on www.neurotechvoice.com.
  The same change is applied in the working tree, so the next commit must
  use `2fcbfa4` (or newer `main`) as its parent. Confirmed in production:
  an owner finished the service onboarding after this deploy (agent row
  created at step 3, voice synced, provider agents created at launch).
- Production data fix (2026-10-14, SQL, no code): migration 024 backfilled
  every pre-024 organization to `business_type = 'services'`, including 7
  that had never started onboarding (step 1, no agent, no number, no Stripe
  customer), so they never saw Step 0. Those 7 were reset to
  `business_type = NULL`, `onboarding_step = 1`, which is exactly a new
  sign-up's state: they now get the services / online store choice. Orgs
  that completed onboarding keep `services`. A Google account registered
  before 024 is not a new account: signing in with it returns its old
  organization.
- `3881da1` feat(billing): prepaid extra minutes and plans that match the
  homepage (2026-10-15). Migrations 027 and 028 applied in production first
  (`list_migrations` shows both; all new columns, `minute_purchases` with
  RLS, the service-role-only functions and both guards verified). Deploy
  `dpl_HFVtFs7TXW3NcN3D9ehyjxN4vXkR` READY on www.neurotechvoice.com; the
  07:30 UTC cron tick ran on it with `ok: true` and the new
  `auto_topup` and `annual_usage_periods` steps. Validation before the push:
  tsc clean, eslint 0 errors, vitest 259 files / 2,956 tests, `next build`
  clean. Supabase advisors: nothing new (only INFO "unused index" on the
  empty `minute_purchases`). Defaults chosen without the owner and easy to
  change: Stripe's 14 free days grant at most 100 minutes
  (`lib/billing/stripe-trial.ts`); upgrades are charged at once, downgrades
  and monthly/yearly switches apply at renewal; "Talk to us" calls the sales
  phone number.
- `4f14e2d` feat(billing): hourly maintenance step `stripe_plan_catalog`
  (lib/billing/stripe-catalog.ts) resolves the monthly and annual Stripe price
  of all 8 self-serve plans through `ensurePlanPriceId`, so the catalogue
  exists in Stripe before any checkout; plus a fix for a replayed product
  create that returned a product archived since. Verified in production: the
  09:10 UTC tick on 2026-10-15 reported `checked 16, ready 16, failed 0`,
  and the six July env pins were logged as `pinned_price_ignored`
  (`untagged`). Stripe (read through the Stripe connector before this):
  no subscriptions. On 2026-10-15 the six July products ("Neuro Tech Voice —
  Starter/Pro/Business") and their six prices were archived through the
  Stripe connector; Stripe now lists exactly the 8 tagged products and the 16
  lookup-key prices (ntv_<plan>_<month|year>) at the PLANS amounts.
- Checkout branding (this follow-up): every Checkout Session (plan, minute
  pack, onboarding, phone number) is created through
  `createBrandedCheckoutSession` (lib/stripe/checkout-branding.ts) with
  `branding_settings`: display name NeuroVoice, white background, #551a89
  button, Inter, rounded corners; the owner's NEUROVOICE wordmark as the
  header logo (public/brand/checkout-logo.png, 870×136, ink on transparent,
  cut from the owner's brand square so it reads at Checkout's ~28px logo
  height) and the brand square itself as the favicon
  (public/brand/checkout-icon.png, 512×512), both served from the app's https
  origin. The owner replaced the crown with this artwork on 2026-10-15. A
  branding field Stripe refuses is logged
  (`stripe.checkout_branding_rejected`, field and code only) and the session
  is created again without branding; `STRIPE_CHECKOUT_BRANDING=off` turns it
  off. Invoices and receipts keep the Dashboard branding (Stripe's rule).
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

| id | name | monthly | annual | minutes | extra minute | family |
|---|---|---|---|---|---|---|
| store_starter | Store Starter | $100 | $1,000 | 350 | $0.25 | ecommerce |
| store_growth | Store Growth | $250 | $2,500 | 950 | $0.22 | ecommerce |
| store_scale | Store Scale | $500 | $5,000 | 2,000 | $0.20 | ecommerce |
| store_enterprise | Store Enterprise | $1,000 | $10,000 | 4,500 | $0.18 | ecommerce, contact sales |

- Pricing note (figures only, no margin claim): blended cost is about $0.10
  per minute. An included store minute sells for about $0.29 on Store
  Starter, $0.26 on Store Growth, $0.25 on Store Scale and $0.22 on Store
  Enterprise's starting fee when every included minute is used, monthly
  billing; a sixth less on annual billing. Extra minutes sell at the plan's
  rate, $0.25 down to $0.18, and up to 12% less in the bigger packs (Store
  Enterprise's 2,500-minute pack works out at about $0.158 a minute). The
  service plans' cost note is in "app plans aligned with the homepage"
  below. Annual = 10 x monthly (two months free), like the service plans.
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
  `ntv_plan` (creates carry Stripe idempotency keys `ntv_product_<plan>` and
  `ntv_price_<plan>_<interval>`, so racing cold lambdas share one product and
  one price); the billing webhook resolves a subscription's plan by price map,
  then `resolvePlanFromPrice` (the price's own metadata / lookup key), and only
  then the subscription metadata `ntv_plan`, which Stripe never rewrites on a
  plan switch.
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

Execution state (updated): the implementation workflow `wf_a8eb3f28-018`
finished (six implementers, first validator green: tsc, eslint, 232 files /
2476 tests, build; three reviews with 20 findings, all fixed or justified).
Its final validator did not run (credit limit). Migration 026 IS APPLIED in
production (CHECK verified: nine plan ids). The fixes sit uncommitted on top
of the WIP commit `22e164c` on `claude/amazing-shannon-ognheq`. A final
validation workflow (`wf_6e95c7d5-e3e`: full checks, money-path verifier,
copy/route verifier, fixer, revalidation) was launched to close the task. If
the session is lost before it finishes, rerun the same four checks and a
money-path review by hand, then continue with step 4 below.

## Added 2026-10-15: prepaid extra-minute packs (owner request)

"After the included minutes are used up, the customer must be able to buy
extra minutes." Decisions (do not re-open): hard cap on every plan (capacity
= included left + purchased balance; unknown plans fail open;
VOICE_TRIAL_MINUTES_ENFORCED=false disables the cap); packs of 100 / 500 /
1,000 / 2,500 minutes priced at the plan's extra-minute rate
(PLANS[plan].overage_per_min: $0.20 on every service plan since the
homepage alignment below, Enterprise included; 0.25 / 0.22 / 0.20 / 0.18 for
the store plans) with volume discounts 0 / 4 / 8 / 12%;
only paid plans can buy; purchased minutes never expire and are used after
the included ones; minutes_used resets on each Stripe renewal
(invoice.paid subscription_cycle / subscription_create, idempotent per
period start); optional auto top-up (threshold 10..1000 minutes, default 50;
off-session invoice on the subscription's payment method; one attempt per
10 minutes; failure disables it and e-mails the owner); 80% and
out-of-minutes e-mails; dashboard banner; store automations defer up to 24 h
when out of minutes. Also fixes: in-place plan switch (no second
subscription), store price validation against PLANS, onboarding notice when a
paid price cannot be resolved, plan display names, atomic one-time business
type, /magazin -> /store redirects, no empty catch in the intent cookie
reader. Migration `027_minute_packs.sql` (new columns, minute_purchases,
credit_minute_purchase, start_usage_period, claim_auto_topup, updated
record_call_usage), then `028_service_plans.sql` (Growth and Scale in the
plan CHECK, billing_interval, roll_annual_usage_periods), must be applied to
Supabase BEFORE deploying, because the code selects the new columns
(remaining step 3). Workflow run: `wf_0867dbb2-576`; WIP
snapshots on `claude/amazing-shannon-ognheq` (22e164c, 96a2859) are to be
squashed with the result onto `7d0cca6` into one commit for `main`.

## Added 2026-10-15: app plans aligned with the homepage (owner request)

The owner saw different plans and prices in the app (billing page,
onboarding launch step, Stripe Checkout) than on the homepage. Decision (do
not re-open): the homepage price list of 23 Sep 2026 wins, and `PLANS`
(`types/index.ts`) is the single source of truth; `lib/site.ts` `TIERS`
reads its numbers from `PLANS`, and `tests/plan-parity.test.ts` holds them
together, so they cannot drift again.

| id | name | monthly | annual | minutes | extra min |
|---|---|---|---|---|---|
| starter | Starter | $49 | $490 | 400 | $0.20 |
| growth | Growth | $99 | $990 | 1,000 | $0.20 |
| pro | Pro (featured) | $249 | $2,490 | 3,000 | $0.20 |
| business | Business | $499 | $4,990 | 5,000 | $0.20 |
| scale | Scale | $990 | $9,900 | 15,000 | $0.20 |
| custom | Enterprise | "Talk to us" (no published price) | | starts from 15,000 | $0.20 |

The store plans keep the values in the table above. Annual = 10 x monthly.

- Cost note (the only margin wording to use): blended cost is
  about $0.10 per minute, so at full use of the included minutes Growth and
  Business run near break-even and Pro and Scale below it; extra minutes at
  $0.20 keep about 50%.
- Stripe prices: an env pin (`STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`,
  `STRIPE_BUSINESS_PRICE_ID` and their `_ANNUAL` variants, created July 2026
  with unknown, probably old amounts; never read or print their values) is
  used only while Stripe reports it active, USD, on the plan's interval, at
  exactly the `PLANS` price, AND tagged `metadata.ntv_plan = <plan>` (price,
  else its product). Otherwise it is ignored (a warning without the id) and
  `ensurePlanPriceId` (`lib/stripe/store-prices.ts`) finds or creates the
  price by lookup key `ntv_<plan>_<interval>`. A price whose amount differs
  from `PLANS` is never charged. Checkout colours and logo are the Stripe
  Dashboard's branding (Settings > Branding), not set from code.
- The 14 free days of a first plan subscription grant at most 100 included
  minutes (`STRIPE_TRIAL_MINUTES`, `lib/billing/stripe-trial.ts`) until the
  first payment; the full allowance once the subscription is active. Default
  chosen without the owner; tell the owner in the hand-off.
- The billing webhook answers 500 when the organizations write fails (Stripe
  retries for up to 3 days), so a Growth or Scale plan paid before migration
  028 is applied is granted once 028 is in place instead of being lost.
- Database: migration `027_minute_packs.sql`, then `028_service_plans.sql`
  (Growth and Scale in `organizations_plan_check`, `billing_interval`,
  `roll_annual_usage_periods`), BEFORE the deploy (remaining step 3). Without
  028 the database refuses `growth` and `scale`.

## Remaining steps for this task (in order)

DONE on 2026-10-15 (commit `3881da1`, see "Delivered on main" above). The
steps below are kept as the runbook for the next billing change.

1. Read the workflow result or re-run validation: `npx tsc --noEmit`,
   `npx eslint .` (0 errors), `npx vitest run`, `npm run build`.
2. Review the money path by hand: `app/api/billing/checkout/route.ts`,
   `app/api/billing/webhook/route.ts`, `app/api/onboarding/complete/route.ts`,
   `lib/stripe/store-prices.ts`, `lib/stripe/client.ts`.
3. Apply the database migrations BEFORE step 4 (pushing to `main` deploys
   to production). Migration 026 is already applied (verified). Apply
   `supabase/migrations/027_minute_packs.sql`, then
   `supabase/migrations/028_service_plans.sql`, with the Supabase MCP
   `apply_migration` (names `027_minute_packs` and `028_service_plans`, the
   file contents as the query; both are re-runnable and rewrite no row, and
   028 needs 027). The new code reads the new columns and throws when they are
   missing: every app-routed inbound call (`lib/telephony/context.ts`
   through `router.ts`), native inbound initiation
   (`lib/telephony/initiation.ts`), store automations
   (`lib/commerce/automations/dispatch.ts`), dashboard metrics and the store
   overview would fail. Verify before going on: `list_migrations` lists both;
   `execute_sql` with `select extra_minutes_balance, usage_alert_notified_at,
   billing_interval from public.organizations limit 1` succeeds; and
   `get_advisors` (security and performance) shows nothing new. Only then go
   on to step 4.
4. Build one commit on top of the current `main` (`2fcbfa4` or newer) with
   `git commit-tree` from the validated working tree (descriptive message and
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

- Stripe account branding (invoices, receipts, customer portal, and the
  Checkout defaults) was set through the Stripe connector on 2026-10-15:
  brand and accent #551a89, white Checkout background, #551a89 button,
  Inter, rounded. Left for the owner: upload the icon in Stripe Dashboard >
  Settings > Branding (the connector exposes no file upload): the brand
  square https://www.neurotechvoice.com/brand/checkout-icon.png (512×512
  PNG, NEUROVOICE on the glow; Stripe wants square, min 128px, max 512 KB).
- Decide whether the homepage service prices stay as they are: at about
  $0.10/min cost, Pro (3,000 min for $249) and Scale (15,000 for $990) lose
  money when a customer uses every included minute; Growth and Business are
  near break-even. Lowering their included minutes is a one-line change in
  `types/index.ts` PLANS (the homepage follows automatically).
- Optional: the July env prices `STRIPE_{STARTER,PRO,BUSINESS}[_ANNUAL]_PRICE_ID`
  are ignored (no `ntv_plan` tag) and their products are archived in Stripe;
  the six Vercel variables can be removed; nothing depends on them.

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
