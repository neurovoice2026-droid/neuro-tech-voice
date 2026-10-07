# ig5 (price reel): product truth for "$49" on screen

Read from the code at HEAD `5127eef` (`claude/remotion-trailer`) on 2026-10-07. This file is the only one written.
Paths are relative to the repo root. `file:line` refers to the line as it is at that HEAD.
Earlier research, `trailer/docs/ig/RESEARCH-product.md`, was checked again here. Where the two differ, this file is the one to use for ig5.

---

## 0. Verdict

1. **"$49 a month" is true**, as the Starter plan fee, in both price lists: site `lib/site.ts:1685` (`TIERS[0].monthly: 49`) and backend `types/index.ts:594` (`price_monthly: 49`). The header menu already prints **"Plans from $49 a month"** (`lib/site.ts:2290`, rendered at `components/site/header/product-panel.tsx:259`). That is the safest wording, because the site already uses it.
2. **$49 is the plan fee and nothing more.** Three things sit on top of it:
   - A phone number: **$1.15/month**, a separate subscription that needs a card.
   - **VAT.** Prices exclude it.
   - **Per-minute usage past the included minutes**, rounded up on every call.

   So the reel must never call $49 "all-in", "total", "flat", "unlimited" or "no hidden fees". The fine print goes in the caption (§5).
3. **What both lists agree on for Starter:**
   - $49/month
   - $490/year
   - that minutes are included and extra minutes are billed
   - no recordings, no Google (so no calendar booking), no voice cloning
   - texts to callers and outbound calls are on
   - it keeps answering past the included minutes

   **What they disagree on:**
   - included minutes: 400 on the site, 150 in the backend
   - overage rate: $0.20 vs $0.25
   - the plan ladder: Growth and Scale exist only on the site
   - support: the backend says "Email support", but no support address exists

   **None of the disputed items may appear in the reel.**
4. **The $49 agent cannot book appointments.** Calendar booking and the waitlist are Pro and up (beta). Showing a booking, a calendar or "Booked" in a $49 reel would be false advertising for that price.
5. **One agent, one language at a time.** Each business gets exactly one agent, and it always speaks the one language it is set to, even when the caller speaks another. "14 languages" means **14 to choose from**. It does not mean the agent switches to the caller's language.
6. **Trial wording that is true everywhere:** "5 free minutes, 14 days, no card." One live line is wrong: `HERO.note` says "5 free minutes every month" (`lib/site.ts:123`). Never say "every month".
7. **Setup:** "Ready in under ten minutes" is on the product page (`lib/pages/ai-agents.ts:40`) and on the register screen (`components/site/register.tsx:179-193, 1376-1381`). It is **not** in the FAQ, which `voice.md` wrongly says. Never say "5 minutes".

---

## 1. The $49 Starter plan in each list

| Field | Site (`lib/site.ts` TIERS + `lib/pages/home/pricing.ts`) | Backend (`types/index.ts` PLANS + `lib/billing/entitlements.ts`) | Same? |
|---|---|---|---|
| Fee | $49/mo (`site.ts:1685`) | $49/mo (`types/index.ts:594`) | **yes** |
| Annual | fee × 10/12 = $40.83/mo, "Two months free" (`site.ts:1636, 1729-1732`); year = $490 (`pricing-math.ts:127`) | `price_annual: 490` (`types/index.ts:595`). The onboarding card rounds it to **$41**/mo (`components/onboarding/steps/Step5Launch.tsx:114-117`) | $490/yr yes; the per-month figure no |
| Included minutes | 400 (`site.ts:1685`) | 150 (`types/index.ts:596, 599`; shown in-app at `Step5Launch.tsx:142`) | **NO** |
| Overage | $0.20/min (`site.ts:1685`) | $0.25/min (`types/index.ts:597, 600`) | **NO** (both bill overage; the rate differs) |
| Keeps answering past minutes | "Keeps answering past the included minutes" (`pricing.ts:74`) | `overageAllowed: true` (`entitlements.ts:50`); the block rule is at `:125` | yes |
| Answers from your documents | Starter perk (`pricing.ts:67`) | Knowledge base on every plan, trial included (`lib/pages/knowledge-base.ts:496-497`) | yes |
| Transcripts kept | Starter perk (`pricing.ts:68-71`); FAQ "transcripts are kept on every plan" (`site.ts:1921`) | not gated (only recordings are) | yes |
| Texts to callers (SMS) | "Confirmation texts to your callers" (`pricing.ts:72`) | `smsConfirmations: true` (`entitlements.ts:48`) | yes |
| Outbound calls from the dashboard | `pricing.ts:73` | `outboundCalls: true` (`entitlements.ts:49`) | yes |
| Analytics | not listed on the Starter card; "30-day call analytics" starts at Pro (`pricing.ts:92`) | "Basic analytics" (`types/index.ts:601`); `advancedAnalytics: false` (`entitlements.ts:44`) | yes (basic only) |
| Support | none listed | "Email support" (`types/index.ts:602`), but `COMPANY.email` is `""` and still marked OWNER (`site.ts:70-79`) | **do not claim** |
| Recordings | off until Pro (`site.ts:1921`, `pricing.ts:90`) | `recordings: false` (`entitlements.ts:42`) | yes (none) |
| Google Workspace and calendar booking | Pro and up, beta (`pricing.ts:91`) | `googleIntegrations: false` (`entitlements.ts:43`) | yes (none) |
| Voice cloning | Pro and up (`pricing.ts:93`) | `voiceCloning: false` (`entitlements.ts:47`) | yes (none) |
| Number of agents | one, on every plan (`site.ts:1621-1634`; `pricing.ts:175`) | — | yes |
| Test calls a day | — | 10 (`entitlements.ts:53`) | — |
| Setup fee | "No setup fee. On any plan." (`pricing.ts:243`) | checkout = plan price + metered overage price only (`lib/stripe/client.ts:184-193`; `app/api/billing/checkout/route.ts:159-176`) | yes (none) |

The OWNER note says the two lists disagree and that "Checkout must match this list before launch" (`site.ts:1678-1682`). The amount actually charged is whatever the Stripe price in `STRIPE_STARTER_PRICE_ID` holds (`types/index.ts:604`). The repo cannot show that amount, so **the owner should confirm that the live Stripe Starter price is $49.00 USD** before the reel goes up.

---

## 2. Starter: what it has and what it does not

| Feature | Starter ($49)? | Evidence |
|---|---|---|
| Answers from your knowledge base | **YES** | `pricing.ts:67`; `knowledge-base.ts:496-497`; `lib/voice/session-loader.ts:236` |
| Takes messages for the team | **YES**, on every plan | `session-loader.ts:241` (`take_message: true`); the team is notified and the message lands in the Inbox (`lib/voice/tools/messages.ts:64-80`) |
| Live transfer to a person | **YES**, with conditions. The owner must list contacts, and it only works on a real phone line. It is a blind transfer with a 25 s ring timeout | `session-loader.ts:240` (no plan gate); FAQ `site.ts:1896` |
| Texts to callers | **YES**, with conditions. The SMS switch must be on, the number must be SMS-capable, and the caller's number must be known. At most 2 texts per call. Links only to the business's own site | `entitlements.ts:48`; `lib/voice/tools/sms.ts:13, 19-31`; `lib/twilio/sms.ts:54-58`; `session-loader.ts:238` |
| Booking-confirmation texts | **NO**, because booking is Pro | booking-confirmation SMS needs a booking (`lib/sms/templates.ts:309`) |
| Calendar booking (check, book, move, cancel) | **NO**: Pro and up, beta, and Google Calendar must be connected | `lib/voice/tools/calendar.ts:22-29` (`bookingGate`); `app/api/scheduling/route.ts:130-132`; `lib/pages/home/gates.ts:11-15` |
| Waitlist | **NO** (Pro) | `lib/voice/tools/waitlist.ts:11-12` |
| Call recordings | **NO** (Pro) | `entitlements.ts:42`; `site.ts:1921` |
| Google Workspace (Gmail, Sheets, Calendar, Docs) | **NO** (Pro, beta) | `entitlements.ts:43`; `lib/workflows/service.ts:70-73` |
| After-call workflows: webhook, Slack, tag, wait | **YES** (no plan gate); an SMS step needs Starter | `lib/workflows/service.ts:68-77`; `lib/workflows/schemas.ts:202-203`; `lib/workflows/executor.ts:211-219` |
| Analytics | basic only | `types/index.ts:601`; `entitlements.ts:44-45` |
| Voice cloning | **NO** (Pro) | `entitlements.ts:47` |
| Languages | **14 to choose from**, not plan-gated; **one per agent** | `lib/agent-languages.ts:6-21`; `lib/voice/prompt.ts:254-256` ("Always speak {language}, even when the caller … use[s] another language") |
| Tells callers it is an AI | **YES**, always | `site.ts:2527`; `prompt.ts:265` |
| Never invents prices, hours or policies | **YES**, an instruction in its prompt | `prompt.ts:266` (an instruction, not a guarantee; the terms disclaim accuracy) |
| Answers at any hour | **YES by default**: it always answers unless the owner chooses "play a message" outside working hours | `lib/voice/router.ts:196-221` |
| Answers past the included minutes | **YES**, billed per minute | `entitlements.ts:17-18, 50, 125`; FAQ `site.ts:1946` |
| Answers real customers with no number | **NO**: a number is a separate purchase | `site.ts:1813` (PRICING_TRIAL.body), `:1932` |

**What the $49 agent truthfully DOES** (once a number is bought):
- It picks up day and night.
- It answers from the documents you gave it.
- It says so when the answer is not written down.
- It takes a message for your team.
- It puts the caller through to a person you listed.
- It can text the caller details (where texts are on and the number supports them).
- It files every call with a transcript.
- It tells callers it is an AI.
- It works in the one language you pick from 14.

**It does not** book, record calls, use Google Calendar, or clone a voice.

---

## 3. Extra costs and terms

| Item | Truth | Source |
|---|---|---|
| Phone number | **$1.15/month**, its own Stripe subscription, "the carrier's own cost … nothing on top". Release it to stop the charge | `lib/phone/pricing.ts:1-6`; `app/api/phone/checkout/route.ts:14-15`; FAQ `site.ts:1932`; pricing facts `pricing.ts:244-246`; receipt note "Your number, $1.15 a month, is billed on its own." `pricing.ts:189` |
| Card | Needed for any paid plan and for the number. Onboarding checkout is `payment_method_types: ['card']` | `app/api/onboarding/complete/route.ts:230-233`; `site.ts:1813` |
| Countries for a number | 21 (US CA GB NZ AT BE CH CZ DK FI HU LU NO PT SE SK SG JP IN BR ZA). **Not** RO, DE, FR, ES, IT, NL or PL | `lib/twilio/countries.ts:14-36`; FAQ `site.ts:1932` |
| Porting | Not supported. The new number sits alongside the existing line | FAQ `site.ts:1932` |
| VAT | "Prices are in US dollars and exclude VAT." | `site.ts:1829` |
| Overage | Exists on every paid plan. The rate is disputed (§1), so never print it | `refund-policy/page.tsx:72-78`; `terms/page.tsx:46-52` |
| Rounding | "minutes are rounded up on each call, so ninety seconds costs two" | `site.ts:1829` |
| Setup fee | **None**: "No setup fee. On any plan. A custom build is quoted on its own." | `pricing.ts:243`; no fee line item exists in checkout (`lib/stripe/client.ts:184-193`) |
| Cancel | "Change plan or cancel whenever. From your billing settings; a cancelled plan runs to the end of the period you paid for." | `pricing.ts:240-241`; `app/(legal)/refund-policy/page.tsx:34-41`; `app/(legal)/terms/page.tsx:61-67` |
| Contract / lock-in | Monthly or annual, renews automatically until cancelled, no pro-rated refunds mid-cycle. **"Cancel anytime" is safe. "No contract" is not**: the Terms are a contract, and annual billing exists | `refund-policy/page.tsx:25-32, 43-70`; `terms/page.tsx:46-58` |
| Price changes | "We may change our prices" with advance notice | `terms/page.tsx:55-57` |
| One agent | One agent per business, on every plan; there is no second agent to buy | `site.ts:1621-1634` |

### Is "$49/month" honest on its own?
- **As a plan-fee figure, yes.** It is the published Starter fee in both lists, and the site's own menu says "Plans from $49 a month".
- **As "what it costs to answer my calls", no.** The minimum is **$49 + $1.15 = $50.15 a month, excl. VAT**, plus any per-minute usage past the allowance.
- **Recommendation:** on screen, "From $49 a month" (preferred) or "$49 a month". Put the fine print in the caption (§5).
  - If the format allows one line of small print on the price card, use: **"+ $1.15/mo number · excl. VAT"**.
  - The current rule is that Tessa speaks every on-screen line. Either she says "plus a number at a dollar fifteen", or the small print is treated as legal fine print and left unspoken. That is the script's call.
  - Do **not** spell out "$50.15". It invites the question of what is included, and the minutes cannot be shown.

---

## 4. Free trial and setup time

| Claim | Status | Source |
|---|---|---|
| "Five free minutes, fourteen days, and no card." | true; the site's pricing headline | `site.ts:1812` |
| "5 free minutes for 14 days · No card needed" | true | `lib/pages/ai-agents.ts:44` |
| "5 free minutes, no card" | true | `pricing.ts:224` |
| "Start your free 14-day trial — no credit card required" | true | `app/(auth)/register/page.tsx:21`; `refund-policy/page.tsx:17-23` |
| The backend trial | 5 minutes, 14 days, never renewed, **no overage**: it stops answering when the minutes are gone | `types/index.ts:578-591`; `entitlements.ts:27-40, 121-125`; FAQ `site.ts:1946` |
| The trial answers real customers | **only test calls until a number is bought (card)**. "until you buy one it answers you and nobody else" | `site.ts:1813` |
| "5 free minutes every month" | **FALSE**, flagged by the OWNER note | `site.ts:123` vs `:1781-1798` |
| Paid plans start with a 14-day free trial (card at checkout) | true **in the app only**: onboarding Stripe checkout sets `trial_period_days: 14`, and the Starter card in onboarding says "14-day free trial". The marketing site never says this. **Do not use it in the reel.** It conflicts with the site's trial story and would show the backend's minutes | `app/api/onboarding/complete/route.ts:243-246`; `Step5Launch.tsx:148, 598` |
| "Ready in under ten minutes" | true (the site's claim) | `ai-agents.ts:40`; `components/site/register.tsx:179, 193, 1376-1381` |
| "Set up in minutes" | true (looser) | `ai-agents.ts:35`; `app/(auth)/layout.tsx:33` |
| "Four screens, then a test call" | true | `lib/pages/home/start.ts:12` |
| "Deployed in 5 minutes" (the bio) | **overclaim** | — |

---

## 5. SAFE and UNSAFE lines for ig5

Card lines are kept to 6 words or fewer. "VO" means Tessa can say it as written.

### 5.1 SAFE (on screen + VO)
| # | Line | Words | Source | Condition |
|---|---|---|---|---|
| S1 | From $49 a month. | 4 | `site.ts:2290`, `:1685`; `types/index.ts:594` | Fine print in the caption (§5.3) |
| S2 | $49 a month. | 3 | same | Same. Never next to "total", "all-in" or "flat" |
| S3 | Plans start at $49. | 4 | `site.ts:2290` | — |
| S4 | No setup fee. | 3 | `pricing.ts:243` | — |
| S5 | Cancel anytime. | 2 | `pricing.ts:240-241`; refund §3 | Runs to the end of the paid period |
| S6 | Plus your number: $1.15/mo. | 5 | `lib/phone/pricing.ts:6`; `site.ts:1932` | Best as fine print |
| S7 | Minutes included. Extra minutes billed. | 5 | `site.ts:1685`; `types/index.ts:596-597`; refund §5 | No counts, no rate |
| S8 | Picks up day and night. | 5 | `router.ts:196-221`; `entitlements.ts:50, 125` | Paid plan + bought number. Not "never misses" |
| S9 | Answers from your own documents. | 5 | `pricing.ts:67` | — |
| S10 | Write your answers once. | 4 | brand line; knowledge base on every plan (`knowledge-base.ts:496-497`) | — |
| S11 | If it's not written, it says so. | 6 | `lib/pages/knowledge-base.ts:362` ("Where your documents stop, it says so") | — |
| S12 | Takes a message for your team. | 6 | `session-loader.ts:241`; `messages.ts:64-80` | — |
| S13 | Puts callers through to your people. | 6 | `session-loader.ts:240`; FAQ `site.ts:1896` | "people you listed"; a blind transfer |
| S14 | Texts your caller the details. | 5 | `entitlements.ts:48`; `sms.ts:19-31`; `pricing.ts:72` | Texts on + SMS-capable number. **Not** a booking confirmation |
| S15 | Every call written down. | 4 | `ai-agents.ts:40`; `pricing.ts:68-71` | Transcripts, not recordings |
| S16 | Tells every caller it's an AI. | 6 | `site.ts:2527`; `prompt.ts:265` | — |
| S17 | Pick from 14 languages. | 4 | `agent-languages.ts:6-21` | One language per agent |
| S18 | Fluent in 14 languages. | 4 | `ai-agents.ts:40` | Same (the site's own wording) |
| S19 | Ready in under ten minutes. | 5 | `ai-agents.ts:40`; `register.tsx:193` | — |
| S20 | 5 free minutes. 14 days. | 5 | `site.ts:1812`; `ai-agents.ts:44` | Split into two cards with S21 |
| S21 | No card needed. | 3 | `ai-agents.ts:44`; `register/page.tsx:21` | Applies to the trial only |
| S22 | Start free. | 2 | `site.ts:1814` (the CTA everywhere) | — |
| S23 | Keeps answering past your minutes. | 5 | `pricing.ts:74, 236-237` | Paid plans only, and billed |

### 5.2 UNSAFE (never in the reel, VO or caption)
| # | Line / idea | Why | Source |
|---|---|---|---|
| U1 | Any Starter minute count ("400 minutes", "150 minutes") or "per minute: $0.20/$0.25" | the two lists disagree | `site.ts:1685` vs `types/index.ts:596-597` |
| U2 | Any other plan or price: Growth $99, Pro $249, Business $499, Scale $990, Custom $999, "$41/mo yearly", "$40.83" | other tiers disagree or don't exist in the backend; the annual per-month figure differs | `site.ts:1684-1699`; `types/index.ts:607-656`; `Step5Launch.tsx:114-117` |
| U3 | "$49, all-in" / "$49 total" / "flat $49" / "that's it" / "no hidden fees" / "everything included" | there is a number fee, VAT, and per-minute usage on top | §3 |
| U4 | "Unlimited calls / minutes", "same price no matter how busy" | minutes are capped; overage is billed | `refund-policy/page.tsx:72-78` |
| U5 | "Books appointments", "fills your calendar", "Booked ✓", any calendar UI, "booking confirmation text", "reminders", "waitlist" for the $49 plan | Pro and up, beta, needs Google Calendar | `calendar.ts:22-29`; `waitlist.ts:11-12` |
| U6 | "Records every call" / recording playback UI | Pro and up | `entitlements.ts:42` |
| U7 | "Works with Gmail / Sheets / Google Calendar" | Pro and up, beta | `entitlements.ts:43` |
| U8 | "Clone your own voice" | Pro and up | `entitlements.ts:47` |
| U9 | "24/7 support", "a real person on support", "email support", "priority support" | no support address; the 24/7 perk is a Pro owner promise not yet backed | `site.ts:70-79`; `pricing.ts:55-61, 101-104` |
| U10 | "Speaks your caller's language", "switches language mid-call", "every language", "all 14 at once" | one agent, one language | `prompt.ts:254-256`; `site.ts:1621-1634` |
| U11 | "Never misses a call", "every call answered, guaranteed", "never wrong" | the absolute was dropped deliberately; the terms disclaim accuracy | `lib/pages/home/call.ts:13-16`; `terms/page.tsx:122` §10 |
| U12 | "Start free and it answers your customers today" | the trial has no number without a card | `site.ts:1813` |
| U13 | "5 free minutes every month" | false | `site.ts:123` vs `:1781-1798` |
| U14 | "Try the $49 plan free for 14 days" | in-app only (with a card); not a site promise | `onboarding/complete/route.ts:243-246` |
| U15 | "Set up in 5 minutes" | overclaim; the site says under ten | `ai-agents.ts:40` |
| U16 | "No contract" / "no commitment" | the Terms are a contract; annual plans exist. Use "Cancel anytime" | `terms/page.tsx:46-67` |
| U17 | "Keep your number" / "port your number" / "local number anywhere" / "numbers in Romania" | no porting; 21 countries only | `site.ts:1932`; `countries.ts:14-36` |
| U18 | "Handles 100 calls at once" or any concurrency claim | not stated anywhere; unverified | — |
| U19 | "Same as a receptionist for $49" / "replaces your receptionist" / "does everything an agency builds" | Starter lacks booking, recordings and Google; it is AI, not a person (an answering service is people). Compare fees, never claim equal features | §2 |
| U20 | "X times cheaper" or a saving figure, unless both sides use the same unit, each competitor figure has a cited source, and the arithmetic is shown | the hard truth rule (no invented numbers) | — |
| U21 | Any competitor name or logo | `voice.md` | `.claude/instagram/voice.md` "Off limits" |

### 5.3 Caption fine print (paste-ready; no em dashes)
> $49/month is the Starter plan fee, in US dollars, excluding VAT. A phone number for the agent is $1.15/month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Starter does not include calendar booking or call recordings (those start on Pro). Free trial: 5 minutes over 14 days, no card needed.

A shorter version for a tight caption:
> Starter plan, USD, excl. VAT. Phone number $1.15/mo extra; usage past included minutes billed per minute. No setup fee, cancel anytime. Free trial: 5 min, 14 days, no card.

---

## 6. Comparison hygiene (for the script stage)

- Compare **plan fee to plan fee** ("from $49 a month" vs the category's entry fee). Every category figure needs a cited public source, and the unit has to match: per month vs per month, never per month vs per call.
- Do not stack a full feature list against "$49". Starter's honest verbs are in §2: answer, explain from your documents, take a message, transfer, text, transcribe. **Never booking.**
- Live answering services are people; our agent is an AI and tells callers so. The comparison is about cost and hours, not about the two being the same thing.
- Agencies and custom builds: our own custom builds are "quoted on its own" (`pricing.ts:243`; `lib/pages/custom-ai-agents.ts`). Don't let "agencies charge hundreds" sound like our custom work is cheap.

## 7. Open items for the owner (not blockers if §5 is followed)
1. Confirm the live Stripe `STRIPE_STARTER_PRICE_ID` is $49.00 USD/month (the repo cannot show it).
2. Settle Starter's minutes (400 vs 150) and overage ($0.20 vs $0.25) before any later reel shows them (`site.ts:1678-1682`).
3. `HERO.note` "5 free minutes every month" (`site.ts:123`) contradicts the backend.
4. `voice.md` says "no prices on Instagram". The owner's request overrides that for **$49 only** in this reel. `voice.md` also cites "site FAQ" for "under ten minutes", but the claim is on the product page.
