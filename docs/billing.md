# Billing: plans, minutes and extra-minute packs

How an organization pays, how its call minutes are counted and capped, how it
buys more minutes (by hand or with auto top-up), and what to do when
something goes wrong. Code references are relative to the repository root.
Migrations `supabase/migrations/027_minute_packs.sql` and
`028_service_plans.sql` hold every database object named here.

## 1. The model in one paragraph

Every plan includes a number of minutes a month (on annual billing too: the
allowance starts over every month, section 4). Calls draw on
those first, then on the organization's prepaid **extra minutes**. When both
are used up, no new call starts (a hard cap on every plan, the trial
included) until minutes are added: a minute pack bought on the billing page,
an automatic top-up, or the next billing period. Nothing is billed after the
fact: there is no overage invoice. Extra minutes never expire and survive
renewals and plan changes.

## 2. Plans

`PLANS` in `types/index.ts` is the source of truth (prices, minutes,
extra-minute price, family). Annual billing is ten times the monthly price.
`overage_per_min` keeps its historical name but is now the **price of one
extra minute** (the 100-minute pack; bigger packs are cheaper, section 5).

| id | name | monthly | annual | included minutes | extra minute | family |
|---|---|---|---|---|---|---|
| `trial` | Trial | $0 | | 5 (once, never reset) | cannot buy | any |
| `starter` | Starter | $49 | $490 | 400 | $0.20 | services |
| `growth` | Growth | $99 | $990 | 1,000 | $0.20 | services |
| `pro` | Pro | $249 | $2,490 | 3,000 | $0.20 | services |
| `business` | Business | $499 | $4,990 | 5,000 | $0.20 | services |
| `scale` | Scale | $990 | $9,900 | 15,000 | $0.20 | services |
| `custom` | Enterprise (sales-led) | no published price | | agreed; starts at 15,000 | $0.20 | services |
| `store_starter` | Store Starter | $100 | $1,000 | 350 | $0.25 | ecommerce |
| `store_growth` | Store Growth | $250 | $2,500 | 950 | $0.22 | ecommerce |
| `store_scale` | Store Scale | $500 | $5,000 | 2,000 | $0.20 | ecommerce |
| `store_enterprise` | Store Enterprise (sales-led) | from $1,000 | | from 4,500 | $0.18 | ecommerce |

An online store holds the trial or a store plan; every other organization the
trial or a service plan (`planAllowedFor`, enforced by
`POST /api/billing/checkout` and `POST /api/onboarding/complete`). The
service ladder is the owner's price list of 23 Sep 2026; `organizations.plan`
accepts `growth` and `scale` from migration `028_service_plans.sql` on.

**One price list.** The homepage pricing section reads its numbers from
`PLANS`: the service cards through `TIERS` in `lib/site.ts` (fee, minutes and
extra-minute rate come from `PLANS`; only the id, name, button and "Our pick"
live there) and the store cards through `lib/pages/home/store-pricing.ts`.
The feature bullets of the app's plan cards (`PLANS[plan].features`) say what
the homepage cards say. `tests/plan-parity.test.ts` fails on any drift:
fees, minutes, extra-minute rates, annual = 10 × monthly, feature bullets.
Enterprise (`custom`) has no published price: `price_monthly` is 0 and no
card may print a fee for it ("Talk to us"); its `minutes_limit` (15,000,
Scale's) is the allowance it starts from, written by the webhook for a
subscription stamped `custom`, and the real allowance is agreed with the
customer.

**The plan card.** Every place the app shows or sells a plan draws the
homepage's card for it, from one set of components in `components/pricing/`:

* `PlanTierCard.tsx`: the presentational card the homepage `#pricing`
  section draws too (fee, per-day and yearly lines, allowance, extra-minute
  rate, badge, perks, the rung's flowing light);
* `plan-tier-view.ts`: what the card for a plan says, read off `PLANS` in the
  homepage's own words (`lib/pages/home/pricing.ts` for the service plans,
  `lib/pages/home/store-pricing.ts` for the store plans), including the
  trial's card (`TRIAL_TIER`), which has no homepage twin;
* `AppPlanTiers.tsx`: the app wrapper (`AppPlanTierCard`, `PlanTiers`): the
  radio of the launch steps, the "Selected" / "Current plan" ring and tab,
  and the card's button in place of the homepage's "Start free";
* `lights.ts`, `plan-tier.css` (the lights, scoped to the cards) and
  `fonts.ts` (the homepage's display face);
* `plan-change.ts`: the current plan's price line on the billing page.

The onboarding launch steps (`components/onboarding/steps/Step5Launch.tsx`,
`components/onboarding/commerce/steps/LaunchStep.tsx`, the sales-led
`ContactSalesPlanCard`) and the billing page's plan picker use them, so a card
in the app reads exactly like the same plan's homepage card;
`tests/plan-tier-cards.test.ts` holds the two together. A sales-led plan never
prints a fee anywhere (no "$0", "$0+" or "$0.00+"): Enterprise says "Priced
with you" and "Talk to us", Store Enterprise "From $1,000 a month" (the
homepage's words for its starting fee).

**Cost note.** The blended cost is about $0.10 a minute (voice and
telephony). When every included minute is used, Starter keeps a thin margin,
Growth ($0.099 a minute) and Business ($0.0998) run near break-even, and Pro
($0.083) and Scale ($0.066) run below cost; extra minutes at $0.20 keep about
50% of what they sell for. The margin comes from allowances that are not used
to the last minute and from extra minutes, not from a fixed percentage on
every plan. Store plans sell an included minute for $0.25 to $0.29 (Store
Enterprise from about $0.22).

### Stripe prices of the plans

Every self-serve plan (a paid plan that is not sales-led: Starter, Growth,
Pro, Business, Scale and the three listed store plans) gets its Stripe price
from `ensurePlanPriceId(plan, interval)` in `lib/stripe/store-prices.ts`, for
checkout, onboarding and the in-place plan switch alike:

1. the env pin `STRIPE_<PLAN>[_ANNUAL]_PRICE_ID`, optional, is used only
   while Stripe reports it active, in USD, on the plan's interval, licensed,
   at exactly the `PLANS` price in cents (and on a live product), **and** it
   is tagged for the plan: `metadata.ntv_plan = <plan>` on the price, or,
   when the price carries no `ntv_plan`, on its product
   (`pinnedPlanTagMismatch`). Otherwise it is ignored with the warning
   `billing.pinned_price_ignored` (the reason: `missing`, `inactive`,
   `currency`, `amount`, `interval`, `usage_type`, `product_inactive`,
   `untagged` or `tagged_other_plan`; never the id) and step 2 applies. A
   price whose amount differs from `PLANS` is never charged. The tag exists
   because the production pins of July 2026 (`STRIPE_STARTER`, `_PRO`,
   `_BUSINESS` and their `_ANNUAL` variants) may bill today's amounts ($49,
   $249, $499) under products named and described for the old minute
   counts, which Checkout would show: untagged, they are ignored. Tag a pin
   only after checking its product's name and description against `PLANS`
   (the app never edits a pinned price's product); removing the pins is
   simpler;
2. the active Stripe price with the lookup key `ntv_<plan>_<interval>`, when
   it bills exactly the `PLANS` price;
3. otherwise the app creates it: one product per plan (metadata `ntv_plan`,
   name = the plan's name, description "3,000 minutes a month, extra
   minutes $0.20/min") shared by the monthly and annual prices, and a
   recurring USD price with the lookup key, metadata `ntv_plan` /
   `ntv_interval` and `transfer_lookup_key`, so a new list price in `PLANS`
   takes the key over from the old one. Creates carry idempotency keys
   derived from the plan and the amount (`ntv_price_<plan>_<interval>_<cents>`;
   `ntv_product_<plan>_<monthly cents>_<label fingerprint>`).

An app-owned product whose name or description no longer matches `PLANS` is
relabeled when it is met (`billing.plan_product_relabeled`); a pinned price's
product is never edited. The billing webhook maps a subscription's price back
to its plan by the env pins first (a stale pin still names its plan, so
subscriptions sold on it keep resolving), then the price's own
`metadata.ntv_plan` / lookup key, then the subscription's `ntv_plan`.

Stripe Checkout's colours, logo and icon are the Stripe account's branding,
set by the owner in the Stripe Dashboard under **Settings > Branding** (brand
colour `#551a89`, accent colour `#140a24`, the logo and the icon); the API
calls used here cannot set them, and no code tries to.

## 3. Included minutes and the hard cap

* **Capacity** = `max(0, minutes_limit - minutes_used) + extra_minutes_balance`
  (`minutesCapacity` in `lib/billing/minute-packs.ts`).
* **At call start** (`callAllowance` in `lib/telephony/quota.ts`):
  * no capacity: no call is placed (dashboard, campaign and store
    automation calls); a native inbound call hears the existing
    "unavailable" line (`lib/telephony/initiation.ts`) and an app-routed one
    is refused by the router like a paused agent (`lib/telephony/router.ts`);
  * otherwise the call may last at most the capacity left (the
    `conversation.max_duration_seconds` override and the Twilio time limit),
    never less than 60 seconds.
* **Fail open**: an unknown plan value or a missing `minutes_limit` is never
  capped, so billing-data drift never takes a phone line down.
* **Global switch**: `VOICE_TRIAL_MINUTES_ENFORCED=false` turns the cap off on
  every plan (the name predates the paid-plan cap). Default: on.
* **Consumption order** (`record_call_usage`, once per call): the minutes of
  a call first fill the included minutes; whatever is past them comes out of
  `extra_minutes_balance` (never below 0). `minutes_used` is the period's
  included usage: it grows only by the minutes the balance did not cover, so
  a purchased minute is never counted again against `minutes_limit` (an
  in-place upgrade, section 9, adds the new plan's extra included minutes for
  the share of the period left). It passes `minutes_limit` only when the balance is empty too (the
  60-second minimum of a capped call, or no cap). `usage_ledger` keeps every
  minute of every call.

## 4. Usage periods (reset on renewal)

`invoice.paid` with `billing_reason` `subscription_cycle` (a renewal),
`subscription_create` (a new subscription) or `subscription_update` with a
full new-period line (a plan change scheduled for the renewal taking effect,
section 9; the prorated invoice of an immediate upgrade has only proration
lines and starts nothing) on the organization's plan subscription calls
`start_usage_period(org, period_start)`. Only the recorded plan subscription
(`organizations.stripe_subscription_id`) renews the minutes; another one
counts only for its first invoice (`subscription_create` stamped `ntv_plan`)
or while none is recorded, so a second subscription's renewals never reset
them. When the new
period starts later than `usage_period_start`, `minutes_used` goes back to 0
and `usage_period_start` moves forward. Replays and out-of-order events change
nothing. `extra_minutes_balance` is kept. The trial has no subscription, so
its minutes never reset.

**Annual plans get their minutes every month.** Every card says "N minutes a
month", but Stripe renews an annual subscription, and so calls
`start_usage_period`, once a year. The webhook stores the interval of the
plan subscription's price in `organizations.billing_interval` (`month` or
`year`) whenever it applies a subscription, and clears it to NULL with the
plan when the subscription stops granting one (canceled, past due, deleted).
The `annual_usage_periods` step of the 5-minute maintenance cron
(`lib/billing/usage-periods.ts`, right before `auto_topup`) calls
`roll_annual_usage_periods()` (migration 028): every organization with
`billing_interval = 'year'`, a paid plan and `usage_period_start + 1 month
<= now()` gets `minutes_used = 0` and `usage_period_start` moved forward by
the whole calendar months elapsed (Jan 31 + 1 month = Feb 28 or 29; a cron
that missed a month catches up in one step). One set-based, row-locked
UPDATE: a second run finds nothing due, and a period start a renewal moved
meanwhile is not rolled again. The yearly renewal then starts the next
subscription year as on a monthly plan. The step logs the count
(`billing.annual_usage_periods_rolled`) and never throws: before migration
028 is applied it logs `billing.annual_usage_periods_unavailable` and reports
`{ rolled: 0, skipped: 'migration_pending' }`.

Two known edges of the calendar arithmetic, both in the customer's favour and
bounded: an anniversary on the 29th to 31st drifts to the end of a shorter
month (Jan 31, Feb 28, Mar 28, ...), so the twelfth monthly reset can come a
few days before the renewal, which resets again; and the reset on the
anniversary itself can run before Stripe has collected the renewal. A renewal
that fails moves the subscription to past due, which the webhook turns into
the trial (5 minutes), so at most the hours until that event are affected.

## 5. Extra-minute packs

Packs of 100, 500, 1,000 and 2,500 minutes, priced at the plan's extra-minute
rate with a volume discount of 0%, 4%, 8% and 12%:
`amount_cents = round(minutes × rate × (1 − discount) × 100)`
(`packQuote` in `lib/billing/minute-packs.ts`; the server always prices from
the plan it has stored, never from the browser).

| rate (plans) | 100 | 500 | 1,000 | 2,500 |
|---|---|---|---|---|
| $0.20 (every service plan, Enterprise included; Store Scale) | $20.00 | $96.00 | $184.00 | $440.00 |
| $0.25 (Store Starter) | $25.00 | $120.00 | $230.00 | $550.00 |
| $0.22 (Store Growth) | $22.00 | $105.60 | $202.40 | $484.00 |
| $0.18 (Store Enterprise) | $18.00 | $86.40 | $165.60 | $396.00 |

Every plan except the trial can buy, the sales-led tiers included. Purchased
minutes never expire while the account exists and are used only after the
period's included minutes.

**Buying on the billing page** (`/billing#minutes`, `components/billing/*`):
`POST /api/billing/minutes/checkout { minutes }` creates a Stripe Checkout
session (mode `payment`, the organization's customer, one `price_data` line
"N extra minutes", `invoice_creation` on, metadata
`{ type: 'minute_pack', org_id, minutes, plan }` on the session, the payment
intent and the invoice). Stripe returns the buyer to
`/billing?minutes=success#minutes` or `/billing?minutes=canceled#minutes`; the
page shows a toast and drops the flag. The minutes are credited by the
webhook only once the session is paid (`checkout.session.completed`, or
`checkout.session.async_payment_succeeded` for a delayed method), through
`credit_minute_purchase`, idempotent on the session id (and on the invoice /
payment intent ids). The trial gets `409 minutes_not_available`.

## 6. Auto top-up

Off by default; set on the billing page (`PUT /api/billing/minutes/auto-topup
{ enabled, pack, threshold }`). The form offers the 500-minute pack and a
threshold of 50 minutes until the owner saves other values.

* **When**: total capacity (included left + extra) is below the threshold
  (10..1,000 minutes, default 50, never above the pack size: the settings
  API answers `400` with `details.reason: 'threshold_above_pack'`, and a
  stored threshold above the pack acts as the pack size, so one charge always
  brings the minutes back above it). Checked after every recorded call
  (`lib/voice-providers/call-store.ts`) and by the `auto_topup` step of the
  5-minute maintenance cron (`sweepAutoTopUps`), which runs before the store
  automations dial.
* **Who**: a paid plan billed through a Stripe subscription with a saved
  payment method: the subscription's `default_payment_method`, else the
  customer's `invoice_settings.default_payment_method`. Turning it on without
  one answers `409 no_payment_method` (`details.reason`: `plan_required`,
  `subscription_required` or `payment_method_required`); the page offers the
  billing portal to add a card.
* **At most one attempt per organization per 10 minutes**: `claim_auto_topup`
  stamps `auto_topup_last_attempt_at` atomically, so concurrent call webhooks
  and the cron never charge twice.
* **How it charges** (`lib/billing/auto-topup.ts`): a Stripe invoice
  (`collection_method: charge_automatically`, `auto_advance: false`, the
  payment method, metadata `{ type: 'minute_pack', source: 'auto_topup',
  org_id, minutes, plan }`), one invoice item for the pack price, finalized
  and paid off-session. Every Stripe write carries an idempotency key
  `ntv_topup_<org>_<claim time>_<step>`. On success the minutes are credited
  at once (`credit_minute_purchase`, idempotent on the invoice id); the
  `invoice.paid` webhook credits the same invoice again as a no-op, which is
  the safety net for a lost response.
* **Stripe unavailable** (a 5xx, a network failure or timeout, a rate limit,
  an idempotency or lock conflict, our own API key or permissions): no payment
  was refused, so nothing is recorded against the owner, no e-mail goes out
  and auto top-up stays on; an invoice left unpaid is voided (or deleted)
  all the same, and the claim cooldown makes the next try wait 10 minutes.
* **On a payment failure** (a declined card, a bank asking to confirm, no
  saved card, an invalid request such as a detached card, an invoice Stripe
  left unpaid): the open invoice is voided (a draft deleted), a `failed`
  row is recorded in `minute_purchases`, `auto_topup_enabled` turns off with
  `auto_topup_failed_at` / `auto_topup_failure` (a customer-safe reason: the
  card decline message, or a generic sentence; a bank that asks for
  authentication cannot be satisfied off-session) and the owner gets the
  "auto top-up failed" e-mail. **It is never retried automatically.** The
  billing page shows the failure; turning auto top-up back on clears it.

## 7. Alerts and where the owner sees them

* **80% e-mail** (`usageAlertEmail`): once per period, after the first call
  that leaves 80% or more of the included minutes used (claimed on
  `usage_alert_notified_at >= usage_period_start`; the trial, which has no
  period, gets it once). Calls paid from purchased minutes do not move
  `minutes_used`, and the claim keeps a long call that runs into them from
  sending it twice. It says calls pause when the minutes
  run out and how to buy minutes or turn on auto top-up (button "Buy
  minutes" to `/billing#minutes`; the trial gets "Choose a plan").
* **Out of minutes e-mail** (`minutesExhaustedEmail`): once per period, when
  capacity reaches 0 (claimed on `minutes_exhausted_notified_at >=
  usage_period_start`). A successful auto top-up right after the call
  prevents it.
* **Auto top-up failed e-mail** (`autoTopUpFailedEmail`).
* **Dashboard banner** on every dashboard page (`components/dashboard/MinutesBanner.tsx`,
  state decided by the dashboard layout with `minutesBannerState`, where the
  cap switch is known): "You're out of minutes. Calls are paused until you add
  minutes." when no call can start, "Running low: N minutes left" below 20%
  of the included minutes (not shown while auto top-up is on). No banner where
  the cap does not apply.
* **Billing page** (`/billing`, section `#minutes`): included usage, extra
  balance, total left, the four packs, auto top-up and the last 20 purchases
  (`GET /api/billing/minutes`).
* **Dashboard metrics**: the "Minutes used" tile adds the extra balance.
* **Store overview**: the problem `minutes_exhausted` offers the same choice
  as the banner (below).

**Upgrade or buy 100: one choice everywhere.** Wherever the owner is told the
minutes ran out (or are running low), the way out is offered as two buttons,
built by `outOfMinutesChoice` / `outOfMinutesActions` in
`lib/billing/upgrade.ts` from `PLANS` and the pack quotes:

1. the next plan up in the organization's own family ("Upgrade to Growth
   (1,000 minutes for $99/mo)", to the billing page's plan picker
   `/billing#plans`), or "Talk to us" (the sales line) when that rung is
   sales-led or the organization already holds the top one; the trial goes to
   the first paid plan of its business type's family;
2. the smallest pack at the plan's extra-minute rate ("Buy 100 minutes for
   $20", to `/billing?buy=100#minutes`, which highlights the pack and never
   charges by itself). Never on the trial, which cannot buy minutes.

It appears in the dashboard banner (`components/dashboard/MinutesBanner.tsx`
via `minutesBannerActions`; the layout passes the plan and the business
type), the "out of minutes" e-mail (`minutesExhaustedEmail`), the billing
page's Minutes section when nothing is left (`components/billing/MinutesSection.tsx`,
`MinutesCard.tsx`) and the store overview's `minutes_exhausted` problem
(`components/commerce/labels.ts`, `ProblemsList.tsx`). The 80% e-mail keeps
its single "Buy minutes" button.

## 8. Store automations when minutes run out

`lib/commerce/automations/dispatch.ts`: a run that is due while the
organization has no capacity is deferred (tried again every 30 minutes,
inside the automation's call window) for up to 24 hours after its scheduled
time (`commerce_automation_runs.minutes_wait_since`), then skipped with the
reason `minutes_exhausted`. Buying minutes or an auto top-up lets the waiting
runs dial on their next attempt. The same wait applies when
`startOutboundCall` itself refuses for lack of minutes (`409`,
`details.reason: 'minutes_exhausted'`: the minutes ran out between the
dispatcher's check and the dial), instead of skipping the run.

Calls under way hold minutes: usage is recorded only when a call ends, so
every call the organization has ringing or in progress (started in the last
2 hours, usage not recorded yet) holds back 2 minutes. Another store call
starts only when the minutes left cover those and this one too (the first
call always may); otherwise the run tries again 5 minutes later
(`MINUTES_RESERVED_REASON`), within the same 24-hour wait. Inbound and
dashboard calls that start at the same moment are still each capped at the
whole capacity left, so a concurrent overrun is bounded by those calls.

## 9. Plan changes

`POST /api/billing/checkout { plan, interval }` finds the organization's plan
subscription in Stripe (`lib/stripe/plan-subscription.ts`): the recorded one
(`organizations.stripe_subscription_id`) is retrieved directly, otherwise
every subscription of the customer is read page by page (each phone number is
a subscription of the same customer, so the plan's is never hidden).

* **No plan subscription** (the trial, or a canceled one): `{ url }` of a
  Stripe Checkout session for a new subscription.
* **A plan subscription with a payment due** (`past_due`, `unpaid`,
  `incomplete`, `paused`): `409`, `details.reason: 'subscription_payment_due'`.
  The owner pays the open invoice in the billing portal first; a new Checkout
  would bill a second plan subscription next to the old one.
* **A live plan subscription** (active or trialing) changes in place and the
  route answers `{ updated: true, plan, effective, effective_at }`:
  * **an upgrade** (a higher price on the same billing interval) applies
    **now**: the new price on the existing item with
    `proration_behavior: 'always_invoice'` and `payment_behavior:
    'error_if_incomplete'`, so the difference for the rest of the period is
    invoiced and collected at once (a declined card answers `402
    payment_declined` and changes nothing). The minutes follow what was paid
    (`lib/billing/plan-change-minutes.ts`): for the current usage period the
    old allowance plus the new plan's extra minutes for the share of the
    period left (`minutes_limit` becomes the new plan's and `minutes_used`
    becomes `min(used, old limit)` plus the extra minutes of the share already
    gone, a compare-and-set so no call's usage is lost); from the next
    renewal, the new allowance in full. On an annual plan the share is that
    of the current month of the year. `effective: 'now'`;
  * **a downgrade, the same price, or a change between monthly and annual
    billing** applies **at the end of the paid period**: a subscription
    schedule keeps the current price until the period ends, then the new one
    (`end_behavior: 'release'`, `proration_behavior: 'none'`). Nothing is
    refunded or charged before; the organization keeps its plan, its
    entitlements and its minutes until that renewal, whose invoice starts the
    new plan's period (`subscription_update` or `subscription_cycle`, section
    4). A second change replaces the pending one on the same schedule.
    `effective: 'renewal'`, `effective_at` the period end;
  * **during a Stripe trial** every change applies now
    (`proration_behavior: 'none'`): nothing is charged until the trial ends;
  * **the plan it already pays for** cancels a pending change (the schedule
    is released) and resumes a subscription set to end.
  The log lines name the plans, intervals and timing, never a price id (they
  can be the env-pinned `STRIPE_*_PRICE_ID` values).

The webhook applies `customer.subscription.created` / `updated` from the
subscription as Stripe has it now (retrieved again: events arrive out of
order after quick switches). Taking the plan away (an inactive status, a
deletion, an untagged price) or renewing the minutes only follows the
organization's recorded plan subscription, or any while none is recorded, so
an old or second subscription never puts a paying organization on the trial.

`POST /api/onboarding/complete` uses the same lookup: an organization that
already has a live plan subscription (Checkout finished in another tab, a
stale Launch tab) or one with a payment due keeps it, with no plan or minutes
written and no Checkout opened (`plan_notice` `subscription_exists` or
`payment_due`). The 14 free days of a Checkout opened at launch are only for
a Stripe customer that never had a plan subscription. Until the first
payment (subscription status `trialing`) the webhook writes at most
`STRIPE_TRIAL_MINUTES` (100, `lib/billing/stripe-trial.ts`) as
`minutes_limit`, never the plan's full allowance: nothing has been paid yet,
and Scale's 15,000 minutes would cost about $1,500 to a sign-up that cancels
before day 14. Once the subscription is `active` the webhook writes the
plan's full allowance, and the first paid invoice (`subscription_cycle`)
starts a new usage period. The launch cards say it ("14 days free with up to
100 minutes, then billed monthly"); packs can be bought during the free
days. 100 is a default chosen without the owner; change the constant to
change it.

The billing page labels each paid card **Upgrade**, **Downgrade** or
**Switch** against the current plan with one rule, `planChangeRelation` in
`lib/billing/upgrade.ts` (`planRank`): the trial ranks lowest, a self-serve
plan by its monthly list price, and a sales-led plan (Enterprise, Store
Enterprise) as the top rung of its family, above every priced plan, so from
Enterprise every card is a downgrade and nothing reads as an upgrade to a $0
list price. The monthly / annual toggle starts on the interval the
organization pays (`organizations.billing_interval`), so an annual subscriber
is never moved to monthly billing by accident. Each card's small print and
the confirmation dialog say when the change applies
(`components/billing/plan-switch.ts`): "Prorated difference charged now" for
an upgrade, "Starts at your next renewal" for anything else, and the dialog
names a billing-interval change explicitly (it warns about minutes already
used above the new allowance only for a change that applies now). After the
change the toast says "Your plan is now Pro." (and the page re-reads the
organization until the webhook has applied it) or "Your plan changes to
Starter on <date>. Until then you keep your current plan and its minutes."
Downgrading to the trial (canceling) goes through the Stripe customer portal.

## 10. Stripe objects and metadata

| object | created by | metadata | handled by |
|---|---|---|---|
| Checkout session, mode `subscription` | `POST /api/billing/checkout` | `ntv_plan` (also on the subscription) | `checkout.session.completed`, `customer.subscription.*` |
| Subscription update (upgrade now, prorated invoice paid at once) | `POST /api/billing/checkout` (in place) | `ntv_plan` updated | `customer.subscription.updated` (retrieved again) |
| Subscription schedule (change at the renewal) | `POST /api/billing/checkout` (in place) | `ntv_plan` on the next phase (stamped on the subscription when it starts) | `customer.subscription.updated`; its invoice → `start_usage_period` |
| Checkout session, mode `payment` (pack) | `POST /api/billing/minutes/checkout` | `type=minute_pack, org_id, minutes, plan` (session, payment intent, invoice) | `checkout.session.completed` / `async_payment_succeeded` → credit |
| Invoice + invoice item (auto top-up) | `lib/billing/auto-topup.ts` | `type=minute_pack, source=auto_topup, org_id, minutes, plan` | inline credit; `invoice.paid` → credit (no-op if done) |
| Invoice of a renewal | Stripe | subscription metadata | `invoice.paid` → `start_usage_period` |

`invoice.payment_failed` of a minute pack sends no "keep your agent active"
e-mail: a failed auto top-up has its own.

## 11. Fiscal invoices and receipts

Every paid Stripe invoice, minute packs included (Checkout issues one through
`invoice_creation`; auto top-up creates one), goes through the existing
`invoice.paid` path: `emitInvoiceForStripePayment` emits the SmartBill fiscal
invoice and the payment e-mail names what was bought ("500 extra minutes"
instead of the plan). Checkout collects the billing address and the tax id for
the fiscal invoice. Invoices are downloadable from the Stripe customer portal.

## 12. Database (migrations 027 and 028)

* `organizations`: `extra_minutes_balance` (>= 0), `usage_period_start`,
  `minutes_exhausted_notified_at`, `usage_alert_notified_at`,
  `auto_topup_enabled`, `auto_topup_pack`
  (100/500/1000/2500), `auto_topup_threshold` (10..1000),
  `auto_topup_last_attempt_at`, `auto_topup_failed_at`, `auto_topup_failure`.
  The trigger `guard_minute_columns` refuses changes to all of them from a
  tenant JWT: only the service role writes them.
* `minute_purchases`: one row per credited or failed purchase (source
  `checkout`, `auto_topup` or `admin`; unique Checkout session and invoice
  ids). RLS: the owner may read their organization's rows; nobody but the
  service role writes.
* Functions (service role only): `credit_minute_purchase`,
  `start_usage_period`, `claim_auto_topup`, and `record_call_usage` (same
  signature as migration 010, now drawing on the extra balance; minutes it
  takes from the balance are not added to `minutes_used`).
* `commerce_automation_runs.minutes_wait_since` (section 8).
* Migration 028: `organizations.billing_interval` (`month` / `year` / NULL,
  CHECK), refused to tenant JWTs by a guard of its own
  (`guard_billing_interval`, trigger `organizations_guard_billing_interval`;
  027 stays the only owner of `guard_minute_columns`, so re-applying either
  migration in any order keeps both guards), and
  `roll_annual_usage_periods()` (service role only, section 4). It also
  widens `organizations_plan_check` to `growth` and `scale`.

## 13. HTTP API

All routes need a signed-in owner (`requireOrg`); mutations check the origin,
validate the body with Zod and are rate limited per organization.

| route | answer |
|---|---|
| `GET /api/billing/minutes` | `MinutesSummaryDto` (`lib/billing/minutes-summary.ts`) |
| `POST /api/billing/minutes/checkout { minutes }` | `{ url }`; 409 `minutes_not_available` on the trial |
| `PUT /api/billing/minutes/auto-topup { enabled, pack, threshold }` | the saved auto top-up settings; 409 `no_payment_method`; 400 `threshold_above_pack` |
| `POST /api/billing/checkout { plan, interval }` | `{ url }` or `{ updated: true, plan, effective: 'now' \| 'renewal', effective_at }`; 409 `subscription_payment_due`; 402 `payment_declined` |

## 14. Operational runbook

* **Deploying**: apply migration 027 to Supabase **before** deploying the
  code (the code selects the new columns). It is additive and idempotent.
  Then apply migration 028 (it lets `organizations.plan` hold `growth` and
  `scale`, adds `billing_interval` and the monthly roll; re-runnable, no data
  change; it needs 027 first) before the code that can write them. Should the
  code land first anyway, the webhook retries a plan update without
  `billing_interval` and the cron step only warns, so plans still apply;
  annual plans then reset yearly until 028 is applied.
* **Env price pins**: the July 2026 `STRIPE_{STARTER,PRO,BUSINESS}[_ANNUAL]_PRICE_ID`
  carry no `ntv_plan` tag, so the app ignores them (warning
  `billing.pinned_price_ignored`, reason `untagged`) and sells its own prices.
  Removing the six variables from Vercel stops the warning.
* **Stripe prices after a price change in `PLANS`**: nothing to do. The next
  checkout of the plan finds the old lookup-key price outdated, creates the
  new one and moves the lookup key (`billing.plan_price_replaced`); an env
  pin at the old amount is ignored (`billing.pinned_price_ignored`). Existing
  subscriptions keep their price until they are switched. To stop the
  warning, remove the pin from the environment (or point it at a price that
  bills the new amount).
* **A customer says minutes are missing after a purchase**: find the
  Checkout session (Stripe dashboard, metadata `org_id`), check
  `minute_purchases` for its id. No row and the session is paid: resend the
  `checkout.session.completed` event from Stripe (the credit is idempotent).
  An asynchronous payment that has not cleared yet is credited when Stripe
  sends `checkout.session.async_payment_succeeded`.
* **Granting minutes by hand** (a goodwill credit, a correction): call
  `credit_minute_purchase(org, minutes, 0, 'usd', 'admin', null, null, null)`
  with the service role. Without a Stripe reference every call credits, so
  run it once.
* **Refunding a pack**: refund the payment in Stripe, then lower
  `extra_minutes_balance` by the unused minutes refunded (service role; the
  balance never goes below 0). Minutes already used are not refundable
  (refund policy, section 5).
* **Auto top-up failed**: the reason is on the organization
  (`auto_topup_failure`) and the failed row in `minute_purchases`; the voided
  invoice is in Stripe. Nothing retries; the owner updates the card in the
  portal and turns auto top-up back on.
* **A charge with no credit** (auto top-up): the `invoice.paid` webhook
  credits it; resend that event from Stripe if needed.
* **Turning the cap off in an incident** (calls refused for everyone):
  set `VOICE_TRIAL_MINUTES_ENFORCED=false` and redeploy; minutes keep being
  counted, nothing is capped. Turn it back on once fixed.
* **Logs**: `billing.minute_pack_credited`, `billing.auto_topup_invoice_credited`,
  `billing.usage_period`, `billing.annual_usage_periods_rolled`,
  `billing.annual_usage_periods_unavailable`, `auto_topup.credited`,
  `auto_topup.charge_failed`, `usage_alert.minutes_exhausted_sent`, and the
  cron steps `annual_usage_periods` and `auto_topup`.
